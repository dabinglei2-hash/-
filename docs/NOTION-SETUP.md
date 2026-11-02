# Notion 笔记配置 · 2026-10-27

## 当前可用范围

首页健康卡下方的「笔记」进入同一 `#notes` 工作台。本地纯文本笔记、分类、搜索、详情、编辑、确认删除、独立笔记JSON与完整v11可用。不配置Notion也能使用；不会自动上传本地内容。当前没有真实Integration/数据源的端到端验收。

`server/notes_server.py` 是可选的Python标准库本机代理，不是已部署云服务。前端不输入、获取或保存Notion Token。Codex中的Notion连接不能替代网站服务端配置。

## 1. 准备专用数据源

1. 在[Notion开发者设置](https://www.notion.so/profile/integrations)创建 **Internal Integration / Internal connection**，选定工作区，启用内容读取、插入、更新能力。无需OAuth。
2. 创建或选择用于笔记的数据库，通过数据库的“连接”授权该Integration。不要使用未授权的链接数据库副本。
3. 服务自动识别唯一 `title` 字段，不要求标题列固定叫某个名字。
4. 可选分类为已有的 `分类` 或 `Category` 列，类型为select或multi_select。也可用环境变量 `NOTION_CATEGORY_PROPERTY` 指定已有列。服务不新建列、不增删分类选项；多分类页面只读，避免丢失其他分类。
5. 复制 **data source ID**。数据库ID和数据源ID不是同一概念；可配置 `NOTION_DATABASE_ID`，仅在该数据库有唯一数据源时自动解析，否则明确报错。多个数据源必须自行选择。

可选分类建议：日常记录、学习笔记、交易系统、AI与网站开发、灵感与想法、其他。请在Notion自行确认创建，不会自动改数据库。

依据：[Internal connections](https://developers.notion.com/guides/get-started/internal-connections)、[数据源ID与权限](https://developers.notion.com/reference/retrieve-a-data-source)、[官方版本说明](https://developers.notion.com/reference/versioning)。当前适配固定 `Notion-Version: 2026-03-11`，没有引入SDK。

## 2. 仅在本机服务端配置

先在原网站导出完整v11并确认下载。保持原浏览器来源（协议、主机、端口）；换成localhost或其他端口会看到另一份本地存储，不代表数据被删除。

在可信PowerShell终端进入项目目录。用隐藏输入，**不要把Token粘贴进聊天、源码、Git、网页或明文命令**：

```powershell
Set-Location 'D:\CODEX\Life OS'
$notionSecret = Read-Host '服务端 Notion Token（隐藏输入）' -AsSecureString
$env:NOTION_TOKEN = [System.Net.NetworkCredential]::new('', $notionSecret).Password
$env:NOTION_DATA_SOURCE_ID = Read-Host '授权的 data source ID'
python server/notes_server.py --port 8000
```

如果8000已由旧静态服务占用，在其原终端Ctrl+C后再启动。不要启动第二个服务抢占端口，也不需要清空浏览器数据。当前开发过程保留原8000服务，未替用户配置凭据或替换该服务。

停止代理后清除当前终端的凭据变量：

```powershell
Remove-Item Env:\NOTION_TOKEN -ErrorAction SilentlyContinue
$notionSecret = $null
```

服务只绑定127.0.0.1；固定向 `https://api.notion.com/v1` 发请求，检查Host/Origin/会话请求标记/类型/大小，不提供任意URL代理和跨域开放接口。静态资源白名单不暴露Git、备份、环境变量或服务源码。系统同一用户下的其他可信本机程序仍可能访问服务；这不等同生产级用户认证。

## 3. 在网页实际验收

打开原 `http://127.0.0.1:8000/#notes/setup`，点击“测试连接并读取列表”。仅成功验证数据源和读取列表后显示已连接。

- 逐条核对真实标题、正文、分类和更新时间。每次载入20页；“继续载入”取后续游标，搜索只针对本地与已载入内容，并明确显示范围，不声称搜索整个未载入工作区。
- 用专用测试笔记验证上传、修改、重新读取；最后明确确认归档到Notion回收站。
- 本地笔记只在详情点击“上传此笔记”并确认后上传；可映射到已有分类。不会自动批量上传。
- 新建采用一个纯文本paragraph（正文保留换行）；空页/单纯文本段落可编辑。多段落、格式、链接、嵌套、图片/数据库等复杂内容仅显示文本摘要并只读保护，完整内容在Notion打开。不支持完整富文本或附件同步。

未配置/失效授权、未共享数据源、限流、网络失败都有中文提示。失败保留已保存的本地编辑，刷新后仍可查看；未点击保存的编辑草稿仅本次页面内存保留，刷新前应先保存，原beforeunload提醒仍在。

## 4. 冲突、幂等与备份

- 每条缓存保存Notion页面ID、数据源ID和远端修订指纹。保存前重新核对，变化时停止；“另存本地副本”保留编辑，“重新读取此页”丢弃待同步编辑前明确确认。
- 稳定操作ID与私有操作日志防止已确认请求重复创建。日志只存ID/摘要/状态，不存Token或正文；默认位于 `%LOCALAPPDATA%/LifeOS/notion-bridge/operations.sqlite3`（无LOCALAPPDATA时为用户目录下LifeOS）。不要随意删除日志后重试不确定的创建。
- 网络/进程中断或标题与正文部分成功时显示“结果待核对”，禁止盲目重发。日志不是Notion备份，也不保证外部并发绝对原子；Notion外部编辑在版本核对与写入之间仍有竞争窗口。
- 独立笔记JSON与完整v11含私人正文/必要缓存，不含Token；恢复只合并本地数据，不向Notion执行创建/修改/归档。待创建操作在导出副本中标为须核对，防止换机器恢复后重复创建。v5–v10原格式保持，不含独立笔记。

## 5. iPhone与部署下一步

本轮只提供响应式网页和本机代理，没有PWA清单、Service Worker、手机安装或云部署。手机的127.0.0.1指向手机自身，不能访问电脑的本机代理。

要在iPhone上连接Notion，下一阶段需选定稳定HTTPS来源和受认证的服务端代理（例如受访问控制保护的Serverless）；把Token放服务端Secret，建立身份/CSRF/限流及恢复方案后再部署。不能直接将当前本机代理绑定公网或放宽跨域。部署、域名和身份方案尚未选择，本轮没有执行。
