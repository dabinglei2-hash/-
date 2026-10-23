# 实际软件架构

初次审计：2026-10-21；2026-10-23增量更新统一学习及个人中心。代码基线：`main` / `9e6f13f` 加保留的日程修改及学习、个人中心改进；既有未跟踪文档与技能保留。本文件依据当前源码；历史报告仅作补充，测试状态见 [STATUS](STATUS.md)。

## 1. 运行方式与目录

静态单页面网站：HTML + CSS + 原生 JavaScript。没有在当前运行入口发现前端框架、打包器、后端、数据库服务或外部 API 调用；没有 `package.json`、统一 npm 构建/测试命令。浏览器加载本地文件，或通过静态 HTTP 服务读取文件。

```text
index.html                 入口、五导航、页面容器与原表单
app.js                     闭包主控制器：状态、校验、业务、路由、存储、备份
history.js                 学习/收支列表的日期/关键词交集、排序、十条分页
record-editor.js           学习/收支编辑校验、原ID保留、日报关联拦截
insights.js                周/月/年日期范围、汇总与趋势分桶
finance-categories.js      分类定义、账单方向关联、名称快照、排行及合并
finance-meta.js            可选图标/预算/手动账户的严格校验及合并
finance-views.js            财务子页、预算/账户表单与SVG图表
finance-ledger.js           日期分组流水展示，复用原列表总数与日合计
content-tools.js           妙想标签校验/合并、交集筛选、全站本地搜索
ideas-ui.js                妙想卡片、菜单、搜索/多选/输入及临时查看状态
schedule.js                日程纯计算、可选元数据校验/读取/安全合并、有限重复实例生成
schedule-ui.js             同一tasks的时间线/月历/待办、元数据字段及重复规则Sheet；写入由app回调
learning.js                独立可选学习元数据校验/合并、时间戳差计算、计时导出副本冻结
learning-ui.js             #learning内四视图、目标/日程关联/专注/真实统计；写入由app回调
ui-icons.js                共用内联SVG图标注册表
ui-system.js               共享UI增强、Sheet、Toast、加载与转场；不访问业务存储
styles.css                 Tokens、共享组件、安全区、动效
workspace.css              原页面布局和兼容规则（layout层）
ideas.css / finance-ui.css  妙想 / 收支与统计的局部样式（components层）
ux.css                     仅兼容说明，入口不再加载
README.md / UI-SYSTEM.md    使用说明与UI细则（部分段落为历史描述）
GIT-GUIDE.md                Git操作说明；不代表远端数据已核实
AGENTS.md / docs/           规则、PRD、架构、状态文档
.agents/skills/            项目级Codex技能说明，不参与网站运行或浏览器存储
backups/                   本机源码副本；Git忽略，不是浏览器数据备份
qa/ / work/                历史验收脚本、合成JSON、报告与截图；Git忽略
```

`index.html` 依次 defer 加载16个JS：history → record-editor → finance-categories → insights → content-tools → ui-icons → ui-system → finance-meta → finance-views → finance-ledger → ideas-ui → schedule → schedule-ui → learning → learning-ui → app。使用 `window.Life*` 全局对象；部分纯函数同时支持 CommonJS供Node校验。没有ES模块构建链。

页面不仅来自HTML：`initializeRecordPages()`、`initializeWorkspacePages()` 等会搬移表单、生成统计控件与弹层；`LifeFinanceViews.configure()`、`LifeIdeasUI.init()` / `LifeScheduleUI.init()` / `LifeLearningUI.init()` 由 app 注入读取/保存/导航回调。编辑前须同时检查HTML和初始化代码。

## 2. 页面与组件定位

| 页面 | 实现位置 |
| --- | --- |
| 首页 / 记录 / 我的 | `index.html` 对应section；`app.js` 的 `renderWorkspaceHome`、`renderPersonal` 等 |
| 学习 / 日程 / 完整日报 | 原表单在HTML；app事件、`record-editor.js`、`history.js`；日程保留`#tasks`与原任务详情toolbar/stepper，展示和扩展字段在schedule-ui，纯计算在schedule；学习工作台在learning-ui，原表单搬入#learning-records折叠区，学习元数据和计时纯计算在learning |
| 收支列表 / 更多 / 分类 | HTML + `renderFinanceOverview` / `renderHistory` / `renderCategories` + `finance-ledger.js` |
| 财务子页 / 分类详情 | `finance-views.js` 渲染到 `#finance-detail-section` |
| 周/月/年与旧月度明细 | app动态生成 `#insights-main`，保留HTML的 `#monthly-legacy-detail` 内容；计算在 `insights.js` / `renderMonthly` |
| 妙想 / 全站搜索 | `ideas-ui.js` + app保存及详情；`content-tools.js`纯查询；不是两套diary |
| 备份 / 设置 | HTML容器 + app的校验、导出、预览、确认与合并 |

CSS层顺序：`reset → layout → components → motion`。公共外观在 `styles.css`，具体组件和变量见 [UI-SYSTEM](../UI-SYSTEM.md)。手机断点为760px，底部安全区通过 `env(safe-area-inset-*)`；圆形快速记录与收支加号预留导航上方空间。使用原生dialog/details和SVG，无外部图表库。

## 3. 路由、返回与日期状态

- 五主路由：`#overview`、`#records`、`#finance`、`#monthly`、`#personal`。共用同一份内存数据及页面，不整站刷新切换。
- 二级：`#learning`、`#tasks`、`#today-record`、`#daily-notes`、`#habits`、`#goals`、`#search`、`#settings`、`#backup`、`#categories`、`#bill/new`。
- 详情：`#task/<id>`、`#note/<id>`、`#goal/<id>`、`#habit/<id>`、`#entry/<study|finance>/<id>`；妙想子状态为 `#ideas/search|menu|select|write`。
- 财务：`#finance/income|expense|bills|budget|assets`；分类为 `#statistics/category/<income|expense>/<编码ID>`，解析与链接生成必须复用 `finance-views.js`，不能自行拼接ID编码。子页查询参数保存月份、周期、日期、排序、页码等适用状态。
- `syncNavigation()` + `routeSectionIds` 显隐section；`openUiPage`/`returnUiPage`/`replaceUiRoute` 结合 Hash 与 History API；监听 `popstate`、`hashchange`。`lifeReturn`、`viewSnapshot`、`homeDate`、`uiDepth` 是临时导航状态，不是新增生活数据模型。
- `captureUiView`/`restoreUiView` 保存日期、查询、页码、滚动、展开状态等；任务使用 `taskNavigation.taskIds` 保存进入顺序，前后切换采用replace而非不断push。详情缺失有提示和列表回退。
- `selected-date` 管首页/学习/任务；收支、统计和妙想另有查看字段，入口按来源联动。财务顶部是所选月份总览，首页进入后列表可仅筛所选日，二者不是同一范围。
- 草稿在内存Map及部分History快照中，不能视作正式持久化或备份。日期/周期等查看设置在导出JSON时收集，未发现独立的常驻“全部设置”存储键。
- 日程三视图不新增主Tab或路由；`LifeScheduleUI.snapshot/restore`纳入原viewSnapshot，保存视图、月历月份、状态/日期范围筛选，列表位置沿用`#task-list`。所选日期仍为selected-date。日程详情沿用原进入时DOM任务顺序；编辑详情时进入同一日程表单。

### 个人中心（2026-10-23）

- `#personal`保留头像/昵称和原五导航。初始化将成长/财富的旧panel搬入`#personal-summary-detail`，原DOM ID及累计数据保留；主分组前两行改为可直接点击的链接，第三行仍是`.skills-details`，不新增路由。
- 成长行用原studies总和/连续学习规则与LifeInsights当前自然周汇总；今日目标只读learningMeta。先用openUiPage保存来源，再定位`#learning`当天统计；财富同样进入`#finance`当前月并清除目标流水筛选。浏览器返回恢复来源日期/位置；新折叠标记仅在原History viewSnapshot中，兼容旧personalPanels，不写业务存储。
- `openPersonalProfile`统一头像按钮、设置及资料搜索的编辑入口；仍用个人四字段、wealthTarget、validatePersonalData和commitPersonalData/savePersonalData原快照保护。失败保留表单/内联提示；取消还原，Escape保留草稿；关闭恢复触发点，Tab在Sheet内循环。成功后render同步首页/收支头像与昵称。技能仍为原五键手动值；保存反馈和焦点恢复，不修改学习记录。
- 用户明确选A：无头像图片字段、主题/货币/周起始日持久偏好或新JSON版本。设置以只读规则行说明USD/浅色/周一/无通知；应用无独立版本号，JSON v8仅为备份格式。无PWA安装/云端账户功能。
- 导出/恢复核心未换格式或合并算法。`#backup-before-restore`只调用原完整v8导出，可在确认导入前手动下载当前数据；不会自动恢复。导出提示改为“已发起下载”，本次会话操作时间仅显示在DOM，刷新丢弃；既不是已保存证明，也不是持久的最近备份时间。

## 4. 实际持久化与记录身份

全部业务持久化使用当前浏览器来源的 localStorage；未发现IndexedDB实现。内存状态由app载入；首次无数据返回空对象，缺省分类可在内存准备。读取/校验失败有停止写入保护，不能将空视图误当作可以覆盖的空存储。

| 键名（禁止擅改） | 实际内容 |
| --- | --- |
| `my-life-dashboard-v1` | `{studies, finances, tasks}` |
| `my-life-dashboard-personal-v1` | `{profile, wealthTarget, skills, diary, habits, goals, dailyLogs}`；兼容旧内容缺少dailyLogs |
| `my-life-dashboard-categories-v1` | `{categories, assignments}`：分类及按账单ID、方向关联的名称快照 |
| `my-life-dashboard-note-tags-v1` | `{assignments:[{recordId,tags}]}`；旧妙想无关联即无标签 |
| `my-life-dashboard-finance-meta-v1` | `{version:1,categoryIcons,budgets,accounts}`；可选财务扩展 |
| `my-life-dashboard-schedule-meta-v1` | 用户已批准的独立可选日程扩展：`{version:1,taskDetails,series,occurrences}`；旧记录无关联可正常读取，不自动写默认元数据 |
| `my-life-dashboard-learning-meta-v1` | 用户已批准的独立可选学习扩展：`{version:1,dailyGoals,plans,focusSessions}`；缺少时内存空值，不在读取/渲染时初始化写入 |

核心记录字段由 `validateRecords` 严格限制：

- 学习：`id,date,content,duration,createdAt`；duration是整数分钟。
- 收支：`id,date,income,expense,note,createdAt`；金额为非负USD数值、最多两位小数；同一原记录可以同时有收入和支出。
- 任务：`id,date,title,start,end,completed,createdAt`；时间为 `HH:mm` 或空串。
- 妙想：`id,date,title,content,createdAt`；没有来源、最后编辑时间或媒体字段。
- 资料：`nickname,identity,goal,motto`；财富目标独立于账户；skills为五个固定键 `webDev,aiTools,english,finance,delivery` 的手动0–100进度。
- 习惯：`id,name,checkedDates,createdAt`；目标：`id,title,targetDate,description,completed,createdAt`。
- 日报：`id,date,completedItems,studyMinutes,income,expense,energy,summary,studyRecordId,financeRecordId,createdAt`，同日仅一条；链接到主数组中的明细。
- 分类定义：`id,type,name,active,createdAt`；关联：`recordId,type,categoryId,label`。改名不改label快照，停用不是删除。
- 财务扩展：图标按categoryId关联；预算按 `id,month,categoryId,amountCents,createdAt,updatedAt`；账户按 `id,name,kind,balanceCents,asOf,archived,createdAt,updatedAt`。金额为整数分，账户类型为asset/liability。
- 日程详情：`taskId,priority,deadline,note`；priority可为null或low/medium/high，deadline可为null或日期，备注最多2000字。重复规则/实例完整字段与决策见[已批准方案A](SCHEDULE-EXTENSION-PROPOSAL.md)；实例以seriesId+date唯一，排除标记保留已删实例身份。

创建时间为毫秒数；业务日为 `YYYY-MM-DD` 字符串。`today()` 用设备本地年月日，区间辅助函数使用UTC日历计算。严格字段校验意味着即使“只追加字段”也必须先设计兼容导入/导出。

保存链路：表单 → 校验/重新读取与旧快照比较 → 构造下一状态 → `saveData`/`savePersonalData` 或 `writeStoreTransaction` → 重新渲染。后者顺序写多个键，失败尝试反向恢复快照；这是应用级回滚，不保证崩溃原子性或完整多标签页同步协议。

日报按date查旧日志，并更新 `studyRecordId`/`financeRecordId` 对应明细；明细另用固定正文/备注“一键今日记录”及日期核对关联。未填写财务不创建新流水；明确填写才保存。重复保存复用ID；关联明细在独立编辑时引导回日报。不得只改日志副本导致统计断链。

日程的`saveSchedule`复用validateData和writeStoreTransaction，写入前比较主记录及日程元数据的原始快照；编辑另比较原任务/详情。失败保留表单，尝试恢复原两键，不声称数据库原子性。普通完成操作仍使用saveData；删除同时移除详情并标记重复实例excluded。模板保存/暂停不改已有实例；`generateScheduleSeries`预计算缺失日期与重叠数量→用户确认→一次保存普通任务及关联。渲染、启动、切日不生成任务，不自动写学习或收入。

### 学习工作台与保存边界（2026-10-23）

- 两入口均保留`#learning`，不新增全站Tab或第二数据源。四视图和计划筛选、记录折叠状态加入原`captureUiView`/`restoreUiView`；学习计划进入`#task/id`仍用原详情顺序及History来源返回，日程详情可开始关联学习。
- dailyGoals为`date,minutes`；plans为`taskId,estimatedMinutes,archived`。标题/日期/完成状态仍只在tasks，优先级仍在scheduleMeta.taskDetails。取消关联保留任务；删除日程时归档学习关联。原任务数据格式不变。
- focusSessions字段见[获批方案A](LEARNING-EXTENSION-PROPOSAL.md)及`LifeLearning.validate`，状态为running/paused/ended/saved/cancelled；只允许一个running/paused/ended。任务引用保留为历史关联，不强制历史任务仍存在。
- `focusAction`在开始时预留固定studyRecordId；显示由accumulatedMs+Date.now()-startedAt计算，setInterval只更新显示。暂停/继续/结束才写状态，离开或刷新保留计时。设备时钟倒退时拒绝转换并显示原因。
- 结束持久化为ended，确认后向下取完整分钟（1–1440）写普通studies记录；毫秒零头保留。跨日默认开始本地日期，确认区可明确选择实际日期，不自动拆日。已有相同预留ID/内容只关联；不同内容停止覆盖。保存状态/原ID防重，人工编辑不被计时覆盖，确认删除仅标记recordDeleted并保留计时历史。
- `saveLearning`复用主校验和多键回滚，写前比较主数据、日程、学习三键原始快照。计时确认先写主记录，再写学习状态；进程中断可能留下ended+已写记录，由预留ID识别处理，不宣称绝对原子性。失败保留输入；原六键不迁移，新增键仅在明确保存时创建。
- 学习首页及统计只读studies；周/月范围复用LifeInsights.summarize。计划预计分钟另列。目标按所选日期设置，未设置不创建默认目标。实际记录仍无备注/起止时间字段。

## 5. JSON导出与恢复

app中的 `exportBackup`、`validateBackup`、`inspectBackupFile`、`analyzeCompleteMerge`、`confirmBackupImport` 是入口；格式标识为 `my-life-dashboard-backup`，选择文件上限10MiB。

- v5兼容导出：`format,schemaVersion,exportedAt,data,personal,financeCategories,noteTags,settings`。
- v6财务导出：在v5基础上增加 `financeMeta`；v5不含自选图标、预算及资产账户。v5/v6格式不变，但均不含日程扩展。
- v7日程导出：在v6基础上增加 `scheduleMeta`，包括备注、优先级、独立截止日、规则及实例/排除标记。
- v8完整导出：在v7上增加 `learningMeta`。只在副本将running计时累计到exportedAt并冻结为paused；本机计时继续，导入后需手动继续。v5/v6/v7原有字段及按钮保留，但不含学习扩展。
- settings包含 `selectedDate,monthYear,monthMonth,personalDate,financePeriod,insightsPeriod,insightsAnchor`，不是登录或云配置。
- 导入校验支持v1–v8的对应严格字段、日期/金额/ID、分类/标签/日程引用；旧文件缺少的分组只在导入内存中补兼容空值，不清空现有扩展。学习目标同日期、计划同taskId、计时同ID不同内容或合并后多个未解决计时停止；v8中的未冻结running状态拒绝导入。日程详情同taskId、模板同ID、实例同seriesId+date的不同内容均停止合并，不能以时间较新为理由覆盖。
- 选择 → 校验 → 重新读取当前数据 → 合并分析/摘要 → 用户点击确认并二次确认 → 再分析最新状态 → 多键保存 → 应用查看设置、刷新界面。
- 相同记录跳过，同ID不同正文等冲突停止；日报另防同日冲突。资料仅填空，已填且不同停止；技能取较高值；同ID同名习惯打卡与标签取并集；同月同分类不同预算ID停止。
- Blob下载文件，文件名含时间和随机后缀；应用没有服务器备份。Git及源码副本不包含浏览器记录；跨地址/端口/设备前须在原来源导出，全部现有扩展应选择v8。旧版程序无法完整导入v8，不得承诺向旧版完整恢复。

## 6. 统计数据流与口径

`主记录数组 → 日期范围/筛选 → 汇总或分桶 → 卡片/SVG/排行`，渲染不重新写记录。

| 范围 / 指标 | 实际代码与口径 |
| --- | --- |
| 首页/每日 | `render`、`renderWorkspaceHome` 按所选date等值过滤；多条学习分钟相加、任务按completed计数 |
| 历史列表 | `LifeHistory.select`；近7天截至anchor，十条分页；合计是全部匹配记录，不仅本页 |
| 日期分组账单 | `LifeFinanceLedger.groupPage`；每组再取同日全部匹配账单，跨页注明条数 |
| 周/月/年 | `LifeInsights.range/summarize`；周一至周日、自然月/年；周/月逐日、年逐月分桶；不重复叠加dailyLogs |
| 金额/完成率 | 主要以 `Math.round(amount*100)` 合计；结余收入减支出；任务完成率 `Math.round(完成/总数*100)`，空任务0% |
| 日均 | app `renderInsights` 的总额÷完整自然日数（含未来日）；无财务记录“—” |
| 分类排行 | `LifeCategories.summarize` 按稳定分类ID归组、金额降序；未分类参与；比例条为金额占比；0金额需关联才能代表该方向交易 |
| 个人成长/财富 | 按所有主学习记录的日期去重计学习日（含0分钟记录）；连续学习截至今天或昨天；净积累为全量收入−支出，财富目标进度限制0–100%；不是账户净资产 |
| 预算/资产 | `finance-views.js` 使用对应月/分类实际支出；活跃手动资产−负债；不自动生成流水 |

## 7. PWA现状与候选方案

现状：只有viewport、theme-color、安全区和响应式UI；未找到manifest链接/文件、Service Worker注册/脚本、安装流程或原生App工程。浏览器普通缓存不等于可靠离线PWA，现阶段也没有云同步、身份认证或服务端数据层。

候选顺序（未实施、待确认）：先建立稳定HTTPS来源及恢复演练 → PWA清单/应用图标/同来源应用壳缓存 → 可控版本更新/回退与离线验收。明确不缓存上传个人记录，不在SW安装/激活中清空localStorage；换来源必须设计导出恢复路径。是否选IndexedDB、何时升级JSON及云端协议需独立设计，不作为“顺手优化”。

云同步及正式App的目标见 [PRD](PRD.md)。服务商、账户、加密、冲突协议、系统能力与发布方式均待确认，不能从当前代码推断已具备。

## 8. 启动、检查与历史测试

以下命令从项目根目录执行。当前电脑存在Node和Python；其他机器是否安装待确认，不自动安装。

```powershell
git status --short
python -m http.server 8000 --bind 127.0.0.1
```

第二条仅启动本机静态服务，访问 `http://127.0.0.1:8000`，按Ctrl+C关闭。老用户继续原地址；双击index可用不代表支持PWA。没有构建步骤，不要编造 `npm run build/test`。

只读语法检查（不验证浏览器功能）：

```powershell
Get-ChildItem -File -Filter *.js | ForEach-Object {
  node --check $_.FullName
  if ($LASTEXITCODE -ne 0) { throw "语法检查失败：$($_.Name)" }
}
```

历史回归入口实际存在：`work/finance-stats-20261017-231338-654/verify-final.cjs`；审阅后可用 `node <该路径>`。需先在8831端口启动本项目静态服务；脚本使用本机绝对路径的Playwright和Chrome、新上下文、合成数据，输出写入work。部分比较还需8832端口的源码副本服务；脚本存在2026-10固定样本/日期假设。它不是可移植CI测试，不能未经审阅就承诺今日可全绿；本次未启动或重跑这些浏览器脚本。

`backups/`、`qa/`、`work/` 和默认名称个人JSON被 `.gitignore` 排除；不是所有改名JSON都会被排除。克隆代码不会自动恢复历史验收材料或生活记录。当前远端可达/推送状态未联网核实。

日程回归入口：`node qa/verify-schedule.cjs`，需先启动当前源码的仅本机静态服务，默认8847；可用`LIFEOS_TEST_BASE_URL`指定loopback来源，`LIFEOS_PLAYWRIGHT_PATH`指定已有Playwright路径（缺少时不自动安装）。脚本只启动全新Chrome上下文、构造合成数据，结果/截图写入`work/schedule-20261022/`；当前本机默认runtime路径存在，其他机器待确认。测试文件未被Git跟踪，交接/克隆前应另行决定纳入方式。

学习回归入口：`node qa/verify-learning.cjs`（loopback默认8850，先运行`python qa/preview-learning.py`）；`qa/verify-learning-extra.cjs <合成v8路径>`补查失败/中断/日期/短屏；`qa/verify-learning-regression.cjs <旧合成v7路径> <修改前源码备份目录>`比较首页/记录布局并回归原编辑、快速记录、统计。均使用已有Playwright和全新Chrome上下文；不接日常浏览器配置，合成结果写入`work/learning-20261022/`。缺少runtime时先说明，不自动安装。具体本次命令、证据与未测边界见[学习报告](LEARNING-REPORT-20261023.md)。

## 9. 项目级 Skills（2026-10-22 安装）

从根目录保留的 `lifeos-skills-pack.zip` 提取三个原始说明文件，未添加网站依赖、脚本或新存储：

- [lifeos-data-guard](../.agents/skills/lifeos-data-guard/SKILL.md)：数据风险、备份恢复与隔离验证。
- [lifeos-ios-design](../.agents/skills/lifeos-ios-design/SKILL.md)：Apple风格的Web界面与iPhone交互检查。
- [lifeos-project-memory](../.agents/skills/lifeos-project-memory/SKILL.md)：以证据维护本项目现有PRD、架构及STATUS；不另建平行文档体系。

三者均是带 `name`、`description` 的 `SKILL.md`，位置为 `.agents/skills/<名称>/SKILL.md`。可在任务中明确写“请使用 lifeos-data-guard 技能……”或其他名称。文件存在与会话自动发现是两项状态；以会话技能列表/选择器确认加载，未出现时重新加载会话或重启Codex。无需修改网站入口、启用云服务或为此运行网站测试。

个人中心回归：`node qa/verify-personal.cjs <先前学习验收生成的合成v8文件>`，先启动现有`python qa/preview-learning.py`（仅本机8850）。脚本使用新Chrome上下文和合成记录；没有真实用户来源或完整JSON时，不据此承诺真实备份已验证。结果及证据见[个人中心报告](PERSONAL-REPORT-20261023.md)。
