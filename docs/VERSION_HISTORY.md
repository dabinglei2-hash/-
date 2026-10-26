# Life OS 版本记录

## v0.2.0-backup-2026-10-26

- 日期：2026-10-26（Asia/Shanghai）
- 版本代码提交：`12f1ee6fc8bd3b1000ad9f250ec4908f48cba2a2`
- 分支：`main`
- 附注标签：`v0.2.0-backup-2026-10-26`，指向上述代码提交；旧标签保留。
- GitHub仓库：https://github.com/dabinglei2-hash/- （origin：https://github.com/dabinglei2-hash/-.git）
- 上一main：`5810d3422f102a48dea3659c0766ba226afcf36e`。
- 当前范围：收支连续日期分组列表、统计迁入我的、社交会话演示与顶部/返回交互；妙想受限富文本、图片、IndexedDB草稿、主动本地中文OCR及完整v9导出/安全恢复。
- 同步文档：README、GIT-GUIDE、PRD、ARCHITECTURE、STATUS、本页、妙想/社交报告和第三方许可。标签中的代码提交包含前述当前说明；本页完整哈希及STATUS通过后续独立文档提交保存，main包含全部记录。
- 新增.gitattributes确保vendor保留厂商原字节及换行；17项资源在工作区和Git暂存内容中均与MANIFEST摘要一致，保留许可证。
- 排除：浏览器localStorage/IndexedDB中的真实记录、照片和草稿、个人JSON导出、源码副本、QA/截图、依赖缓存、凭据、环境文件及技能ZIP。合成社交SVG及OCR模型为运行所需公开资源。
- 修改前保护：`C:\Users\Administrator\.codex\tmp\lifeos-git-backup-20261026-081633`，含3270个既有文件（645个JSON）的SHA256清单、初始Git状态与文档原件；后续仅更新本轮文档，原应用代码、旧JSON和备份内容保持。
- 本地离线Git备份包位置：`C:\Users\Administrator\.codex\tmp\lifeos-git-backup-20261026-081633\LifeOS-v0.2.0-backup-2026-10-26.bundle`；离线包含Git代码历史和标签，不含个人浏览器数据。本机校验结果保存在该目录`backup-verification.json`，未随仓库上传。

### 本次实际检查

- 19个应用JS语法通过，300个HTML静态ID唯一、27个本地脚本/样式引用存在；Git差异检查和本地文档链接检查通过。
- 17项vendor大小与SHA256一致，已核对Git暂存字节；厂商CRLF和许可末尾空行按原样保留，项目其余文件继续正常空白检查。
- 候选文件名和凭据模式检查未发现风险命中；未暂存个人数据导出或备份目录。
- 重跑39组隔离Chrome检查：妙想24组、社交顶部15组，errors均为空，妙想外部请求为空；包含v9往返/旧版兼容、原ID/草稿/图片/失败保护、真实本地中文OCR、导航/滚动/手机及桌面视口。
- 本地结果：`work/ideas-rich-20261026/run-2026-10-26T00-17-27-736Z/results.json`、`work/social-header-20261025/run-2026-10-26T00-18-52-883Z/results.json`。work/qa保持忽略，克隆不带这些证据和依赖夹具。
- 未重跑全部历史套件；实体iPhone/Safari/系统相机、真实用户JSON与照片恢复、万级记录性能未验收。历史100/55组不计入本轮39组。

### 从GitHub安全恢复代码

在项目以外的父目录执行，目标目录必须尚不存在：

```powershell
git clone https://github.com/dabinglei2-hash/-.git lifeos-restore-2026-10-26
cd lifeos-restore-2026-10-26
git switch --detach v0.2.0-backup-2026-10-26
git rev-parse HEAD
```

结果应为 `12f1ee6fc8bd3b1000ad9f250ec4908f48cba2a2`。需要继续开发时再执行 `git switch -c codex/restore-2026-10-26`。本版本完整哈希记录位于main的后续文档提交，可用 `git show origin/main:docs/VERSION_HISTORY.md` 查看。

网络不可用时，可将上面clone的URL替换为本机bundle的带引号完整路径；在全新目录恢复，不对原项目执行破坏性reset/clean，不自动覆盖原有记录。

### 数据恢复边界与目录

- 实际工作目录为 `D:\CODEX\Life OS`，旧名称目录联接只在当前电脑存在。Git克隆不重建该兼容入口。
- 当前完整用户数据需在原浏览器来源主动导出 **v9**，包括妙想格式/图片/未保存草稿；v5–v8不完整包含这些扩展。Git和bundle均不能替代它。
- 保留日常浏览器、主机名与端口；本次未进入用户日常数据来源。换来源后须先在隔离环境核对v9预览、引用和冲突，再由用户确认恢复；不把旧数据包直接覆盖新记录。

### 远程核验

```powershell
git ls-remote origin refs/heads/main refs/tags/v0.2.0-backup-2026-10-26 'refs/tags/v0.2.0-backup-2026-10-26^{}'
```

标签解引用应为 `12f1ee6fc8bd3b1000ad9f250ec4908f48cba2a2`；main应包含后续版本文档提交。使用普通快进原子推送，不强制覆盖远程或移动既有标签。

## v0.1.0-backup-2026-10-23

- 日期：2026-10-23（Asia/Shanghai）
- 分支：main
- 版本提交：`1a7dc09c0df3b0dbb444d9e872bd56575c01245e`
- 附注标签：`v0.1.0-backup-2026-10-23`（指向上述代码版本提交）
- 仓库：https://github.com/dabinglei2-hash/-
- 远程：origin，https://github.com/dabinglei2-hash/-.git
- 上一基线：9e6f13f7658db3d8986950da97f00a6e546301cd
- 备份范围：当前日程、学习工作台、个人中心改进，项目规则、技能源码、需求/架构/交付文档；保留既有功能与存储格式。
- 排除：浏览器真实生活数据、JSON导出、backups、work、qa、环境文件、密钥、数据库、依赖/构建产物和技能分发ZIP。既有本地文件未删除。
- 本记录通过后续独立文档提交保存，因此版本标签内不含本记录；main包含版本代码和本记录。代码版本哈希与文档提交哈希不同，避免自引用哈希问题。

### 本次实际检查

- 16个应用JavaScript文件的 `node --check` 全部通过。
- HTML 298个静态ID无重复，20个本地脚本/样式引用存在。
- `git diff --check` 和暂存区差异检查通过。
- 检查候选文件名、凭据模式、既有提交历史；未发现凭据命中，CSS类名误报已复核。未提交数据导出或归档。
- 修改前2333个既有文件建立SHA256清单；提交前除预期.gitignore修改外全部一致。最终核验还允许本次STATUS更新。
- 未重新执行浏览器回归、真实手机验收或真实用户数据恢复；历史报告中的通过数量不作为本次测试结果。项目无package.json、无统一构建命令。
- 修改前状态、清单及.gitignore/STATUS副本：`backups/pre-git-backup-20261023-093717-332962/`（仅本地）。

### 安全恢复代码

在项目外的父目录中执行，目标文件夹必须尚不存在；不要覆盖当前工作目录：

```powershell
git clone https://github.com/dabinglei2-hash/-.git lifeos-restore-2026-10-23
cd lifeos-restore-2026-10-23
git switch --detach v0.1.0-backup-2026-10-23
git rev-parse HEAD
```

应得到 `1a7dc09c0df3b0dbb444d9e872bd56575c01245e`。需要在恢复副本继续开发时，可创建新分支：

```powershell
git switch -c codex/restore-2026-10-23
```

版本记录保存在远程main的后续文档提交中，可用 `git show origin/main:docs/VERSION_HISTORY.md` 查看。
不要对原项目执行破坏性reset/clean。保留原地址和浏览器数据；新文件路径、端口或主机名对应不同存储来源。Git不备份localStorage；如需数据恢复，须由用户在原来源导出完整v8文件，再在隔离副本中检查预览和冲突，确认后恢复。本次未核实真实JSON的新鲜度或可恢复性。

### 远程核验

```powershell
git ls-remote origin refs/heads/main refs/tags/v0.1.0-backup-2026-10-23 'refs/tags/v0.1.0-backup-2026-10-23^{}'
```

附注标签的解引用结果应等于版本提交；main应包含后续版本记录提交。使用普通快进/原子推送，不强制推送，不移动已有标签。
