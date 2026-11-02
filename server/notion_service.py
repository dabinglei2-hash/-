"""Optional loopback-only Life OS Notion adapter; standard library, no browser token.

No credentials are loaded from repository files. Only the configured data source
is accessible. The operation ledger stores hashes/IDs, never note bodies/tokens.
"""
import hashlib
import json
import os
import re
import sqlite3
import threading
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler

API_VERSION = '2026-03-11'
ID_PATTERN = re.compile(r'^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$')


class NotesError(Exception):
    def __init__(self, message, status=400, code='invalid', uncertain=False):
        super().__init__(message)
        self.status, self.code, self.uncertain = status, code, uncertain


def normalize_id(value):
    try:
        return str(uuid.UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise NotesError('数据源或页面ID无效。') from None


def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class NotionClient:
    def __init__(self, token):
        self._token = token
        self._opener = build_opener(NoRedirect())
        self._last = 0
        self._lock = threading.Lock()

    def request(self, method, path, body=None):
        if not path.startswith('/') or '://' in path or '..' in path:
            raise NotesError('服务端路径无效。')
        payload = None if body is None else json.dumps(body, ensure_ascii=False).encode()
        request = Request('https://api.notion.com/v1' + path, data=payload, method=method,
                          headers={'Authorization': 'Bearer ' + self._token, 'Notion-Version': API_VERSION,
                                   'Content-Type': 'application/json'})
        # Serialize and pace requests. Never automatically retry a write.
        with self._lock:
            time.sleep(max(0, .36 - (time.monotonic() - self._last)))
            self._last = time.monotonic()
            try:
                with self._opener.open(request, timeout=25) as response:
                    raw = response.read(2 * 1024 * 1024 + 1)
                    if len(raw) > 2 * 1024 * 1024:
                        raise NotesError('Notion响应过大，未截断保存。', 502, 'response', method != 'GET')
                    return json.loads(raw)
            except HTTPError as error:
                # Never forward upstream response bodies or credential-bearing URLs.
                messages = {401: 'Notion授权无效或已失效，请在服务端检查Token。',
                            403: 'Integration没有所需权限，请检查内容读写能力。',
                            404: 'Notion页面或数据源不存在，或尚未授权给Integration。',
                            429: 'Notion请求受限，请稍后手动重试。'}
                retry = error.headers.get('Retry-After', '')
                suffix = (' 建议等待 ' + retry + ' 秒。') if retry.isdigit() else ''
                code = {401: 'unauthorized', 403: 'forbidden', 404: 'missing', 429: 'rate_limit'}.get(error.code, 'upstream')
                raise NotesError(messages.get(error.code, 'Notion请求未完成，请核对配置和页面。') + suffix,
                                 429 if error.code == 429 else 502, code, error.code >= 500 and method != 'GET') from None
            except (URLError, TimeoutError, OSError, ValueError):
                raise NotesError('无法确认Notion响应；编辑已保留，请核对远端后再操作。', 502, 'network', method != 'GET') from None


class OperationLedger:
    def __init__(self, path):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        with sqlite3.connect(path) as db:
            db.execute('CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, digest TEXT NOT NULL, state TEXT NOT NULL, page_id TEXT)')

    def begin(self, operation, fingerprint):
        with sqlite3.connect(self.path) as db:
            row = db.execute('SELECT digest,state,page_id FROM operations WHERE id=?', (operation,)).fetchone()
            if row:
                if row[0] != fingerprint:
                    raise NotesError('操作ID对应不同内容；请保留草稿并重新核对。', 409, 'conflict')
                if row[1] == 'done':
                    return row[2]
                if row[1] == 'failed':
                    db.execute("UPDATE operations SET state='started' WHERE id=?", (operation,))
                    return None
                raise NotesError('上次操作结果不确定，禁止自动重复创建/修改；请在Notion核对。', 409, 'uncertain', True)
            db.execute('INSERT INTO operations VALUES (?,?,?,NULL)', (operation, fingerprint, 'started'))
        return None

    def finish(self, operation, state, page_id=None):
        with sqlite3.connect(self.path) as db:
            db.execute('UPDATE operations SET state=?,page_id=? WHERE id=?', (state, page_id, operation))


class NotesService:
    def __init__(self, env=None, client=None, ledger_path=None):
        env = os.environ if env is None else env
        self._token = env.get('NOTION_TOKEN', '')
        self.source_id = env.get('NOTION_DATA_SOURCE_ID', '')
        self.database_id = env.get('NOTION_DATABASE_ID', '')
        self.category_name = env.get('NOTION_CATEGORY_PROPERTY', '')
        self.configured = bool(self._token and (self.source_id or self.database_id))
        self.client = client or NotionClient(self._token)
        private = Path(env.get('LOCALAPPDATA') or Path.home()) / 'LifeOS' / 'notion-bridge' / 'operations.sqlite3'
        self.ledger_path = ledger_path or private
        self.ledger = None  # No filesystem/database initialization until an actual write.
        self.schema = None
        self.lock = threading.Lock()

    def status(self):
        return {'configured': self.configured, 'connected': self.schema is not None,
                'sourceId': self.source_id if self.schema else None,
                'categories': self.schema['categories'] if self.schema else [],
                'message': '已验证授权数据源。' if self.schema else '尚未连接Notion；可先使用本地笔记。'}

    def connect(self):
        if not self.configured:
            raise NotesError('服务端缺少NOTION_TOKEN与数据源ID；请按连接说明在本机配置。', 503, 'not_configured')
        self.schema = None
        if not self.source_id:
            db = self.client.request('GET', '/databases/' + normalize_id(self.database_id))
            sources = db.get('data_sources', [])
            if len(sources) != 1:
                raise NotesError('该数据库有多个数据源；请在服务端明确配置NOTION_DATA_SOURCE_ID。')
            self.source_id = sources[0]['id']
        self.source_id = normalize_id(self.source_id)
        data = self.client.request('GET', '/data_sources/' + self.source_id)
        properties = data.get('properties', {})
        titles = [name for name, spec in properties.items() if spec.get('type') == 'title']
        if len(titles) != 1:
            raise NotesError('数据源未找到唯一标题字段；不会自动调整数据库结构。')
        category = self.category_name or next((name for name in ('分类', 'Category') if properties.get(name, {}).get('type') in ('select', 'multi_select')), '')
        if category and properties.get(category, {}).get('type') not in ('select', 'multi_select'):
            raise NotesError('指定分类字段须为select或multi_select；不会修改原数据库。')
        spec = properties.get(category, {})
        self.schema = {'title': titles[0], 'category': category, 'type': spec.get('type'),
                       'categories': [option['name'] for option in spec.get(spec.get('type'), {}).get('options', [])]}
        return self.status()

    def require(self):
        if not self.schema:
            self.connect()

    def blocks(self, page_id):
        results, cursor = [], None
        while True:
            query = {'page_size': 100}
            if cursor:
                query['start_cursor'] = cursor
            data = self.client.request('GET', '/blocks/' + page_id + '/children?' + urlencode(query))
            results.extend(data.get('results', []))
            if len(results) > 300:
                raise NotesError('页面超过300个顶层块，请在Notion打开；本版本不截断编辑。')
            if not data.get('has_more'):
                return results
            cursor = data.get('next_cursor')
            if not cursor:
                raise NotesError('Notion分页状态无效。', 502)

    @staticmethod
    def rich_text(value):
        return ''.join(item.get('plain_text', item.get('text', {}).get('content', '')) for item in value)

    def page(self, page_id, raw=None):
        self.require()
        page_id = normalize_id(page_id)
        data = raw or self.client.request('GET', '/pages/' + page_id)
        parent = data.get('parent', {})
        if parent.get('type') != 'data_source_id' or normalize_id(parent.get('data_source_id', '')) != self.source_id:
            raise NotesError('页面不属于授权的笔记数据源。', 403, 'scope')
        if data.get('in_trash') or data.get('archived'):
            raise NotesError('该Notion页面已归档或移至回收站。', 404, 'missing')
        blocks = self.blocks(page_id)
        properties = data.get('properties', {})
        title = self.rich_text(properties.get(self.schema['title'], {}).get('title', [])) or '无标题'
        category_value = properties.get(self.schema['category'], {})
        category = category_value.get('select') or {}
        if self.schema['type'] == 'multi_select':
            choices = category_value.get('multi_select', [])
            category = choices[0] if choices else {}
        else:
            choices = []
        title_parts = properties.get(self.schema['title'], {}).get('title', [])
        simple = len(blocks) <= 1 and all(item.get('type') == 'text' and not item.get('text', {}).get('link') and
                   not any(v for k, v in item.get('annotations', {}).items() if k != 'color') and
                   item.get('annotations', {}).get('color', 'default') == 'default' for item in title_parts)
        body = []
        for block in blocks:
            kind = block.get('type', '')
            content = block.get(kind, {})
            rich = content.get('rich_text', [])
            clean = all(item.get('type') == 'text' and not item.get('text', {}).get('link') and
                        not any(v for k, v in item.get('annotations', {}).items() if k != 'color') and
                        item.get('annotations', {}).get('color', 'default') == 'default' for item in rich)
            simple = simple and kind == 'paragraph' and not block.get('has_children') and clean and content.get('color', 'default') == 'default'
            line = self.rich_text(rich)
            if kind == 'to_do':
                line = ('[x] ' if content.get('checked') else '[ ] ') + line
            if line:
                body.append(line)
            if block.get('has_children'):
                body.append('〔含子内容，请在Notion查看完整页面〕')
            if not rich and kind != 'paragraph':
                body.append('〔' + kind + '内容，请在Notion查看〕')
        body = '\n'.join(body)
        if len(body) > 100000 or len(title) > 200:
            raise NotesError('此页面超出本版编辑容量，请在Notion打开。')
        return {'id': page_id, 'sourceId': self.source_id, 'title': title, 'body': body,
                'category': category.get('name', ''), 'createdAt': data['created_time'], 'updatedAt': data['last_edited_time'],
                'url': 'https://www.notion.so/' + page_id.replace('-', ''),
                'revision': digest({'properties': properties, 'blocks': blocks, 'edited': data['last_edited_time']}),
                'editable': bool(simple and len(choices) <= 1),
                '_blocks': blocks}

    @staticmethod
    def public(row):
        return {k: v for k, v in row.items() if not k.startswith('_')}

    def list(self, cursor=''):
        self.require()
        if not isinstance(cursor, str) or len(cursor) > 200:
            raise NotesError('列表游标无效。')
        body = {'page_size': 20, 'sorts': [{'timestamp': 'last_edited_time', 'direction': 'descending'}]}
        if cursor:
            body['start_cursor'] = cursor
        data = self.client.request('POST', '/data_sources/' + self.source_id + '/query', body)
        rows = [self.public(self.page(page['id'], page)) for page in data.get('results', []) if page.get('object') == 'page' and not page.get('in_trash') and not page.get('archived')]
        return {'notes': rows, 'nextCursor': data.get('next_cursor') if data.get('has_more') else None, 'sourceId': self.source_id}

    def properties(self, title, category):
        if category and category not in self.schema['categories']:
            raise NotesError('该分类不在Notion现有选项中；未自动新建分类。')
        props = {self.schema['title']: {'title': [{'type': 'text', 'text': {'content': title}}]}}
        if self.schema['category']:
            props[self.schema['category']] = {self.schema['type']: ([{'name': category}] if category else []) if self.schema['type'] == 'multi_select' else ({'name': category} if category else None)}
        return props

    @staticmethod
    def paragraph(body):
        return {'object': 'block', 'type': 'paragraph', 'paragraph': {'rich_text': [
            {'type': 'text', 'text': {'content': body[i:i + 2000]}} for i in range(0, len(body), 2000)]}}

    def mutate(self, request):
        allowed = {'operationId', 'action', 'pageId', 'sourceId', 'revision', 'title', 'body', 'category'}
        if not isinstance(request, dict) or set(request) != allowed:
            raise NotesError('操作字段不正确。')
        operation, action = request['operationId'], request['action']
        if not isinstance(operation, str) or not re.fullmatch(r'[a-zA-Z0-9_-]{1,120}', operation) or action not in ('create', 'update', 'archive'):
            raise NotesError('操作身份或类型无效。')
        for name, limit in (('title', 200), ('body', 100000), ('category', 100), ('revision', 200)):
            if not isinstance(request[name], str) or len(request[name]) > limit or '\x00' in request[name]:
                raise NotesError('内容字段超限或无效。')
        if not request['title'].strip():
            raise NotesError('标题不能为空。')
        # Serialize both baseline checks and writes from this bridge. External
        # Notion edits still have a race window; Notion has no conditional write.
        with self.lock:
            self.require()
            if normalize_id(request['sourceId']) != self.source_id:
                raise NotesError('目标Notion数据源已改变，停止写入。', 409, 'conflict')
            page_id = normalize_id(request['pageId']) if action != 'create' else None
            props = self.properties(request['title'], request['category'])
            if self.ledger is None:
                self.ledger = OperationLedger(self.ledger_path)
            previous = self.ledger.begin(operation, digest({'target': self.source_id, **request}))
            if previous:
                return {'archived': True, 'pageId': previous} if action == 'archive' else {'note': self.public(self.page(previous)), 'replayed': True}
            wrote = False
            try:
                old = self.page(page_id) if page_id else None
                if old and old['revision'] != request['revision']:
                    raise NotesError('Notion内容已变化，本地编辑已保留；请核对冲突。', 409, 'conflict')
                if action == 'archive':
                    self.client.request('PATCH', '/pages/' + page_id, {'in_trash': True})
                    wrote = True
                    self.ledger.finish(operation, 'done', page_id)
                    return {'archived': True, 'pageId': page_id}
                if old and not old['editable']:
                    raise NotesError('此页含复杂块或格式，只读保护；请在Notion编辑。', 409, 'readonly')
                paragraph = self.paragraph(request['body'])
                if action == 'create':
                    created = self.client.request('POST', '/pages', {'parent': {'type': 'data_source_id', 'data_source_id': self.source_id}, 'properties': props, 'children': [paragraph]})
                    wrote = True
                    page_id = normalize_id(created['id'])
                else:
                    blocks = old['_blocks']
                    # Update one plain paragraph in place; never flatten/erase rich blocks.
                    if old['body'] != request['body']:
                        if blocks:
                            self.client.request('PATCH', '/blocks/' + normalize_id(blocks[0]['id']), {'paragraph': paragraph['paragraph']})
                        else:
                            self.client.request('PATCH', '/blocks/' + page_id + '/children', {'children': [paragraph]})
                        wrote = True
                    if old['title'] != request['title'] or old['category'] != request['category']:
                        self.client.request('PATCH', '/pages/' + page_id, {'properties': props})
                        wrote = True
                row = self.page(page_id)
                if row['title'] != request['title'] or row['body'] != request['body'] or row['category'] != request['category']:
                    raise NotesError('远端回读与提交不一致，停止重试并保留本地编辑。', 409, 'uncertain', True)
                self.ledger.finish(operation, 'done', page_id)
                return {'note': self.public(row)}
            except NotesError as error:
                uncertain = error.uncertain or wrote
                self.ledger.finish(operation, 'uncertain' if uncertain else 'failed', page_id)
                if uncertain:
                    raise NotesError('远端可能已部分保存；本地内容保留，请在Notion核对后再处理。', error.status, 'uncertain', True) from None
                raise
            except Exception:
                self.ledger.finish(operation, 'uncertain', page_id)
                raise NotesError('操作结果无法确认，已停止自动重试；请保留草稿并在Notion核对。', 502, 'uncertain', True) from None
