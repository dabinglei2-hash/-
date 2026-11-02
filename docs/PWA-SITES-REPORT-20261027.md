# PWA 与 Sites 交付记录

日期：2026-10-27。当前外壳：`2026.10.27-8bbfd50199c2a646`。产品功能与数据格式仍为完整v11。

## 发布结果

- **已保存版本1并私密部署成功**：[线上 Life OS](https://life-os-personal-20261027.yellowape13.chatgpt.site)。Sites原生接口状态`succeeded`，随后get_site确认同一live URL/版本1。
- Sites项目：`appgprj_6ae0c18393c0819198cc9248b4799cf9`；版本：`appgprj_6ae0c18393c0819198cc9248b4799cf9~appgver_bcbd720f87308191ba3c581967224f34`；部署：`appgdep_6ae0c53e8fac81918e13ba58490dfff0`。
- 访问：custom，仅owner一人，无editor或外部访客；没有开启公开分享。未登录HTTP访问返回403，未绕过身份验证。
- 发布产物提交：`f0bb105ccd266f8fa3cfe7dc0abc1ef9ab55e42b`；原main/HEAD `7cdfe58`及工作区未暂存/提交。独立Sites发布仓库仅包含经过白名单导出的dist和hosting配置，不是重建业务项目。
- 保存先于部署；发布前已报告目标、仅本人范围、本地存储、PWA验证边界、跨来源迁移及隐私限制。没有上传用户记录、JSON备份或Token。

## 变更文件

| 文件 | 作用 |
| --- | --- |
| `index.html` | 增加manifest/图标/Apple元数据、加载PWA资源；设置新增安装/离线/更新说明，其他页面与8张首页卡不改。 |
| `manifest.webmanifest`、`assets/icons/` | 相对scope/start_url；本项目绘制L标记，192/512/maskable/Apple180/favicon32及SVG。 |
| `pwa.js`、`pwa.css` | 独立安装能力检测、真实网络/外壳状态、更新检查与安装说明；独立窗口安全区，不访问业务存储。 |
| `scripts/sw-template.js`、生成的`sw.js` | 精确静态白名单+SHA256；完整版本等待激活，Hash导航离线；不缓存API/私人JSON/授权响应。 |
| `scripts/build-pwa.mjs`、`scripts/check-pwa.mjs` | 无依赖静态导出与完整性/私有文件/凭据模式检查；不清空已有产物目录。 |
| `server/static_server.py` | 修复Windows默认JS MIME，正确返回JS/mjs/manifest，拒绝私有目录；仅loopback。 |
| `server/notes_server.py` | 原可选本机代理兼容manifest及PWA no-cache响应；API/密钥机制不变，未发布服务端。 |
| `.openai/hosting.json` | 保存同一Sites项目身份与静态dist配置，不含凭据。 |
| `docs/PRD.md`、`docs/ARCHITECTURE.md`、`docs/STATUS.md`及本报告/审计 | 更新真实实现、验证、迁移和App阶段边界，保留历史。 |

源码原件及校验清单：`backups/pre-pwa-sites-20261027-231804593273/`。该备份不包含真实浏览器记录，不等于个人JSON备份。

## 离线、更新与限制

首次必须联网完整下载基础资源。缓存包括全部本地脚本/样式/图标和已有Quill/OCR静态资源；只存核实后的源码字节及内容类型。原10个localStorage键、妙想IndexedDB、v11和兼容格式完全保留，无数据迁移。

断网后已缓存外壳可打开、刷新、走原Hash路由，原本地模块继续保存本机数据；Notion远端同步不可用，社交仍是会话演示。离线OCR静态资源已纳入白名单，实际离线识别未另行验收，不额外声称通过。

更新不调用skipWaiting/clients.claim、不强制刷新、不动表单/计时。新版完整下载后显示等待，保存输入并关闭所有LifeOS窗口后重开。失败保留当前版本；只清理本应用同scope、明确命名的旧外壳缓存，不清理其他Cache Storage、localStorage或IndexedDB。

Sites静态部署不运行Python Notion代理；线上本地笔记可用，真实Notion连接仍待受认证的服务端方案、服务端环境变量及授权验收。本轮不引入账号、云数据库、原生插件或新依赖。

## 实际测试

### 本轮通过：55组（47组隔离Chrome＋8组模拟服务）

- PWA专项13组：生产59文件白名单/哈希/图标；本机自签名HTTPS下SW注册/单scope/空数据不写存储；API/private JSON不缓存和no-store探测；完整v11含元数据/图片/草稿往返、重复恢复；15个主/隐藏路由离线刷新；375/390/414px、375×500短屏、1366px布局/44px控件；返回；未保存笔记保持；更新等待及全部窗口关闭后激活；只清理自身缓存；下载失败保留旧版与数据；同浏览器跨来源不会获得旧数据；子路径；坏哈希不能激活。无页面运行/控制台错误。
  - 脚本：`qa/verify-pwa.cjs`（被Git忽略、依赖本机既有Playwright与Chrome）。证据：`work/pwa-sites-20261027/run-2026-10-27T15-43-26-670Z/results.json`。
  - 本机测试证书只在ignored work中；测试Chrome忽略此合成证书，仅用于隔离HTTPS验证，未修改系统证书、线上身份或安全配置。
- 原助手/首页/习惯/目标及v11回归18组：`work/assistant-home-20261027/run-2026-10-27T15-24-53-873Z/results.json`。
- 原社交/收支/统计/日期/学习/日程及兼容备份回归16组：`work/multipage-ui-20261026/run-2026-10-27T15-24-53-897Z/results.json`。
- 可选Notion代理回归8组：`python qa/verify-notes-service.py`，仅FakeNotion和loopback HTTP，无真实外部请求；覆盖权限、幂等、冲突、网络不确定性、复杂正文保护与私有文件拒绝。证据：`work/notes-service-20261027/run-2026-10-27T15-53-11-435567Z/results.json`。
- `node scripts/check-pwa.mjs`、JS语法、Python源码编译、备份哈希、修改范围、Git差异与文档链接另行检查，不混算为浏览器测试组。

### 发现并处理

1. 两个初次回归因浏览器拒绝`text/plain`的SW失败：浏览器控制台“The script has an unsupported MIME type ('text/plain').”，无JS调用栈/源码行号（浏览器资源装载错误）；请求8000/8850的sw.js均证实错误MIME。根因是Windows默认http.server映射，新增static_server并兼容原notes_server后重跑通过。旧失败证据保留。
2. 首次离线刷新`page.reload: net::ERR_INTERNET_DISCONNECTED`，调用栈为`qa/verify-pwa.cjs`离线路由测试：SW未去除Request.url中的Hash，未命中缓存。模板规范化Hash后通过，不改业务路由。
3. 测试脚本最初错误断言健康导入时间必须不变、使用不存在的notes-edit-title，已按真实模型/控件修正；无业务公式更改。失败结果未删除。
4. Sites初次打开新仓库缺hosting配置、后来短期源凭据过期：补入原项目hosting配置并对同一ID续发凭据后完成；未重复创建站点、未更换平台/放宽访问。

### 尚未测试 / 不作通过声明

- iPhone实机Safari、系统软键盘、安全区、主屏幕图标/独立启动、后台/存储回收与PWA更新体验。
- 线上登录后的SW安装/离线：浏览器自动化绑定超时，未改为公开站点或生成绕过Token；平台部署成功与此项验收分开。内置浏览器已请求打开站点，需用户正常登录本人账号后验收。
- 真实用户完整v11下载文件及恢复、跨设备迁移、真实Notion授权/读写、手环连接。
- 全站所有旧CRUD的穷尽验收；本轮已有对应回归及合成备份，不等于无缺陷保证。

## 使用、迁移与回退

1. 原本机来源继续使用 `http://127.0.0.1:8000/`。启动：`python server/static_server.py --port 8000`，不要改端口并误以为数据被删除。
2. 在原来源“我的→数据备份”导出完整JSON v11，检查下载文件。不要把个人文件放到dist、代码仓库或发送聊天。
3. 在新网址正常登录Sites所属账号；新站空数据属于来源隔离。进入备份选择该文件，阅读分类/数量/冲突预览后由用户确认恢复，核对代表性记录/附件，保留旧来源及文件。两来源以后不会自动同步；不要交替写入后假设已合并。
4. iPhone Safari打开线上地址→系统分享→添加到主屏幕；如有“作为网页App打开”保持开启。安装后先检查是否同一份数据，必要时在安装窗口另行预览确认恢复。不同系统/容器存储行为需实际核实。
5. 在“我的→查看应用与数据说明→安装与离线”检查外壳状态，联网缓存完成后再测试断网重开。平台私密访问不等于本机离线二次锁屏；共享设备不应导入私人备份。
6. 代码回退先保留当前用户JSON；Sites后续只重新部署已保存的明确版本，不删除存储或覆盖旧备份。本次是首个Sites版本，无更早线上版本。旧缓存不能替代源码版本/数据备份。

未来原生App：先完成iPhone/PWA实际验收，再分阶段评估持久化适配层、认证/权限、同步冲突、Notion HTTPS服务及Capacitor/原生桥接。不要一次重构现有模块；设备协议、后台能力、存储容器和商店签名另行验证。

参考：[Apple iPhone安装说明](https://support.apple.com/en-ca/guide/iphone/iphea86e5236/27/ios/27)、[WebKit Safari 26](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)、[MDN Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)。官方能力说明不是本项目真机验收证据。
