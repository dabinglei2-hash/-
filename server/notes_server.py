"""Run explicitly: python server/notes_server.py --port 8000 (loopback only)."""
import argparse
import json
import mimetypes
import secrets
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, unquote

from notion_service import NotesError, NotesService

ROOT = Path(__file__).resolve().parent.parent


class Server(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True

    def __init__(self, address, service):
        super().__init__(address, Handler)
        self.service = service
        self.csrf = secrets.token_urlsafe(32)


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**mimetypes.types_map, '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json'}

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        pass  # Do not print URLs, request bodies, credentials or note contents.

    def end_headers(self):
        self.send_header('X-LifeOS-Notes-Bridge', 'local-v1')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'DENY')
        if self.path.startswith('/api/'):
            self.send_header('Cache-Control', 'no-store')
        elif urlsplit(self.path).path in ('/sw.js', '/manifest.webmanifest', '/', '/index.html'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def guard(self, write=False):
        port = self.server.server_address[1]
        hosts = {f'127.0.0.1:{port}', f'localhost:{port}'}
        if self.headers.get('Host') not in hosts:
            raise NotesError('仅允许本机来源访问。', 403, 'origin')
        origin = self.headers.get('Origin')
        if origin and origin not in {'http://' + host for host in hosts}:
            raise NotesError('不允许跨来源访问。', 403, 'origin')
        if self.headers.get('Sec-Fetch-Site', 'same-origin') not in ('same-origin', 'none'):
            raise NotesError('不允许跨来源访问。', 403, 'origin')
        if write and (not origin or self.headers.get('X-LifeOS-Request') != self.server.csrf):
            raise NotesError('页面会话已失效，请重新测试连接；草稿保留。', 403, 'session')

    def output(self, value, status=200):
        raw = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def error(self, error):
        self.output({'error': str(error), 'code': error.code, 'uncertain': error.uncertain}, error.status)

    def do_GET(self):
        try:
            self.guard()
            path = urlsplit(self.path).path
            if path.startswith('/api/'):
                service = self.server.service
                if path == '/api/notes/status':
                    self.output({**service.status(), 'session': self.server.csrf})
                elif path == '/api/notes/list':
                    self.output(service.list(parse_qs(urlsplit(self.path).query).get('cursor', [''])[0]))
                elif path.startswith('/api/notes/page/'):
                    self.output({'note': service.public(service.page(path.removeprefix('/api/notes/page/')))})
                else:
                    raise NotesError('接口不存在。', 404, 'missing')
                return
            # Only public web assets; never expose server code, Git, backups or data.
            decoded = unquote(path)
            target = (ROOT / decoded.lstrip('/')).resolve()
            if decoded == '/':
                self.path = '/index.html'
            elif not target.is_relative_to(ROOT) or any(part.startswith('.') for part in Path(decoded).parts) or not (
                    target.parent == ROOT and target.suffix in ('.html', '.js', '.css', '.webmanifest') or
                    target.is_relative_to(ROOT / 'assets') or target.is_relative_to(ROOT / 'vendor')) or not target.is_file():
                raise NotesError('资源不可访问。', 404, 'missing')
            super().do_GET()
        except NotesError as error:
            self.error(error)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception:
            self.error(NotesError('本机服务暂时无法完成请求；原数据保留。', 500, 'server'))

    def do_POST(self):
        try:
            self.guard(True)
            if self.headers.get_content_type() != 'application/json':
                raise NotesError('仅接受JSON请求。', 415)
            try:
                length = int(self.headers.get('Content-Length', '0'))
            except ValueError:
                raise NotesError('请求长度无效。') from None
            if not 0 < length <= 512 * 1024:
                raise NotesError('请求大小无效。', 413)
            try:
                request = json.loads(self.rfile.read(length))
            except (ValueError, UnicodeError):
                raise NotesError('JSON请求无效。') from None
            if self.path == '/api/notes/connect' and request == {}:
                self.output(self.server.service.connect())
            elif self.path == '/api/notes/mutate':
                self.output(self.server.service.mutate(request))
            else:
                raise NotesError('接口不存在或字段不正确。', 404, 'missing')
        except NotesError as error:
            self.error(error)
        except (BrokenPipeError, ConnectionResetError):
            return
        except Exception:
            self.error(NotesError('请求未完成，请保留草稿并核对远端。', 500, 'uncertain', True))

    def do_HEAD(self):
        self.output({'error': '请使用GET。'}, 405)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Life OS optional local Notion bridge; no remote deployment.')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    if not 1024 <= args.port <= 65535:
        parser.error('port must be between 1024 and 65535')
    try:
        print(f'Life OS 本机服务：http://127.0.0.1:{args.port}/ （仅本机；未配置时使用本地笔记）', flush=True)
        Server(('127.0.0.1', args.port), NotesService()).serve_forever()
    except KeyboardInterrupt:
        sys.exit(0)
