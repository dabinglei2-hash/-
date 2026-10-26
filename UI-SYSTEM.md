# 我的生活管理台 · UI System

本规范统一现有原生 HTML / CSS / JavaScript 页面。组件层不读写生活记录；原四个 localStorage 键和已批准的独立财务扩展键、记录字段、JSON v5 / v6 沿用现有实现。

## 文件职责

- `styles.css`：唯一 Design Tokens、共享组件外观、交互状态、安全区和动效。
- `workspace.css`：从原三份样式整理出的页面布局与兼容规则。新增组件外观应写入组件层，避免继续添加页面特定皮肤。
- `ux.css`：空兼容文件；入口不再加载。
- `ui-icons.js`：唯一图标源，24×24 viewBox、1.75 线宽、应用内默认 21px；图表不是图标。
- `ui-system.js`：组件标记、图标挂载、Sheet 关闭、Toast、加载状态和转场状态；不访问 localStorage。
- `app.js`：现有业务与路由调用上述 UI helper；保存、校验、合并和统计继续使用原函数。

CSS 层顺序为 `reset → layout → components → motion`。组件层优先于旧布局中的兼容外观，避免通过选择器权重竞争。旧规则只在确认后清理。

## Design Tokens

| 类别 | 变量 |
| --- | --- |
| 颜色 | `--bg`、`--surface`、`--surface-elevated`、`--surface-muted`、`--text-primary`、`--text-secondary`、`--text-tertiary`、`--border`、`--divider`、`--danger` |
| 圆角 | `--radius-small:6px`、`--radius-control:12px`、`--radius-card:16px`、`--radius-nav:24px`、`--radius-sheet:28px`、`--radius-pill` |
| 间距 | `--space-1` 至 `--space-6` = 4 / 8 / 12 / 16 / 24 / 32px；另有细线、半格和 20px 控件间距 |
| 文字 | `--font-xs` 至 `--font-xxl` = 12 / 13 / 15 / 16 / 21 / 28px；重点数据 `--font-metric:32px`；输入 `--font-input:16px` |
| 阴影 | `--shadow-subtle`、`--shadow-card`、`--shadow-floating` |
| 动效 | `--motion-fast:140ms`、`--motion-normal:190ms`、`--motion-slow:220ms`、`--ease-standard` |
| 尺寸和安全区 | `--control-height:44px`、`--icon-size:21px`、`--page-width:960px`、`--page-gutter`、`--safe-top`、`--safe-bottom`、`--nav-clearance`、`--finance-fab-band:64px` |

旧布局用到的 `--text`、`--ink`、`--shadow` 等仅为新变量的别名。禁止再建立另一套主题数值。精确的图表、边线和几何尺寸可保留必要数值。

## 共享组件

| 组件 | 入口 / class |
| --- | --- |
| AppHeader | `.app-header`、一级 `.section-heading` / `.home-header` |
| BackButton | `.nav-return-button`，唯一二级返回栏 `#route-backbar` |
| IconButton | `.ui-icon-button`，兼容 `.icon-button` / `.square-button` |
| PrimaryButton / SecondaryButton | `.primary-button` / `.secondary-button` |
| FloatingActionButton | `.today-record-fab` |
| ListRow / SettingRow | `.ui-list-row` / `.settings-row` |
| GroupedCard / GroupedRow | `.ui-group-card` / `.ui-group-row`，共用图标、主副标题、元数据与进入箭头布局 |
| MetricCard / ContentCard / FloatingCard | `.ui-metric-card` / `.ui-content-card` / `.ui-floating-card` |
| SegmentedControl | `.segmented` / `.ui-segmented` |
| BottomNavigation | 唯一 `.mobile-bottom-nav`，五项路由不变 |
| BottomSheet | `dialog.ui-sheet` / `.bill-sheet-surface` |
| Modal | `dialog.ui-modal`，复用 `confirmAction()` |
| Toast | 唯一 `#app-toast`，`LifeUI.toast(message, error)` |
| Input / Select / SearchField | `.ui-input` / `.ui-select` / `.ui-search-field` |
| ProgressBar | `.ui-progress`、原任务和财富进度条 |
| EmptyState | `.empty-state` / `.inline-empty` |
| Loading | `LifeUI.setBusy(button, boolean)`，`aria-busy` 和原生 disabled |

普通控件至少 44px，底部 Tab 为 52px。图标按钮必须有 `aria-label`。列表中有勾选框、编辑和删除时，各操作保持独立，不把它们嵌套进整行链接。

## 图标用法

静态模板使用 `<span data-icon="search"></span>`；动态模板可使用 `LifeIcons.render('edit')`。图标名称在 `LifeIcons.names` 中列出。所有 SVG 来自该 registry，不复制路径、不用字符箭头或 emoji 充当操作图标。用户正文、标签、金额正负号和头像首字不属于装饰图标，不进行替换。

## 导航和返回

2026-10-25按用户明确要求调整一级入口：首页 `#overview`、记录 `#records`、收支 `#finance`、社交 `#social`、我的 `#personal`。统计保留`#monthly`，迁到“我的”，复用统一返回栏；统计及其分类详情选中“我的”。社交详情`#social/post/<id>`复用原History来源与位置快照，选中“社交”。

二级页面统一使用应用返回栏。返回优先使用现有 `history.state.lifeReturn`；任务详情继续使用原 `taskNavigation`，今日回顾继续调用原返回函数。原关键词、日期、分页、滚动快照和任务序列继续保留。直接打开二级链接时使用对应模块作为安全后备，不统一跳首页。

`uiDepth` 只存在浏览器历史状态中，用于判断转场方向，不进入 localStorage 或备份。任务前后切换不重复播放整页位移动效。原页面中的重复返回控件只隐藏展示，统一返回栏调用相同逻辑。

## Sheet、Modal、Toast 和动效

Sheet 使用白色表面、统一顶部拖动条、左侧标题、右侧关闭按钮；手机贴底，桌面居中。原生 dialog 保留焦点约束；账单路由保留原有 Tab 焦点约束和来源恢复。关闭时间从 `--motion-fast` 读取。

删除及放弃操作复用确认 Modal；恢复备份在原有预览后再使用同一 Modal 确认安全合并。没有添加覆盖模式或清空入口。

Toast 成功显示 2.8 秒、错误显示 5 秒；详细错误仍在原表单内保留。进入新的账单 Sheet 时清除上一次的过期操作反馈，避免盖住输入。

Tab 切换淡入；二级进入或返回仅 4px 轻微位移；Sheet 进入 220ms、关闭 140ms。按下反馈为 0.98 缩放或列表背景变化，键盘使用可见焦点。`prefers-reduced-motion` 下关闭非必要动画、过渡和按下 transform。

## 数据边界

UI helper 不得调用存储、初始化记录或生成业务 ID。保存成功后仍由原业务函数更新摘要。JSON 格式、分类快照、日报关联和标签 sidecar 均保持不变。

验收脚本只能使用全新的浏览器上下文和项目中的合成样本；不能连接用户日常 `file:///` 页面，也不能读取、清空或替换该来源的记录。

## 财务任务接入补充（2026-10-17）

- `finance-views.js`：复用 Token、registry 图标、卡片、ListRow、AppHeader、Sheet、Toast 和现有路由。首页 FAB 与记账 FAB 共用同一组样式；主统计与分类详情共用唯一图表 renderer。六个记录入口复用同一矩形卡片规则。
- `finance-meta.js`：独立的可选扩展校验/合并模块；与 UI helper 分开，不会在读取或渲染时初始化存储。`app.js` 继续负责事务写入和备份。
- 分类图标从 `LifeIcons` registry 选择，显示名称由 `LifeIcons.label()` 提供。当前开放 30 个统一线性图标，分三组；未逐一复刻参考图片里的全部图标。
- 新详情路由：`#finance/income`、`#finance/expense`、`#finance/bills`、`#finance/budget`、`#finance/assets` 与 `#statistics/category/<type>/<encoded-id>`。现有五个主入口、名称和 DOM 保持原样。查询参数只保存查看条件，不属于业务记录。
- 详情返回仍走 `openUiPage/returnUiPage`，主统计来源快照追加周期/指标/排序状态，流水详情继承来源模块选中态。预算与账户草稿在站内导航中保留；离开文档时提示未保存内容。
- 月份选择复用 Sheet。取消、关闭、Escape 回到原月份和筛选；确认采用新月份。列表、表单和按钮继续使用同一按压、焦点与减少动态效果规则。
- 经用户批准，保留原 v5 导出并新增完整 v6 导出。该扩展不改变 UI Token、旧数据字段或原统计算法，详见财务方案与本轮报告。

## 参考图 29 与紧凑账单补充

- 图标从 22px 收紧到 21px，17/22px 重点文字调整为 16/21px；正文在组件层明确为 15px，避免旧布局的 13px body 覆盖统一变量。输入保持 16px，不机械缩小触控区域。
- 分组卡片使用统一白色表面、16px 圆角和轻阴影；76px 起的行高，内部细分隔线从文字列开始。普通列表与输入框继续保持平面效果。设置页也复用该卡片容器。
- 个人页把原成长、财富 disclosure 和技能 disclosure 放入同一卡片，没有建立新业务页面或路由。铅笔的可见圆面约 28px，实际按钮为 44px；它仍调用原个人设置监听器。技能图标新增到原 registry，不引入第二套图标库。
- `personalPanels` 和收支分类概览展开状态仅进入 History 查看快照；离开后返回可恢复，不写入记录或 JSON。
- `finance-ledger.js` 仅生成显示内容。分组来自当前页，日合计继续调用 `LifeHistory.select()`，沿用原搜索、排序、分页及整数分计算；不直接读写存储，不拆分混合账单。
- 收支日期筛选复用原字段并放入统一 Sheet；原搜索输入移动到顶部，不复制控件或绑定第二套保存事件。日期错误继续显示原校验结果。
- 收支 FAB 居中，手机预留 64px 操作带并计入安全区；桌面主内容也预留底部空间，长列表内部滚动。返回快照包含短屏的外层与账单列表滚动位置。
- 菜单在页面/列表滚动时关闭；输入框失焦触发的文字滚动不会关闭账单菜单，避免长关键词搜索后无法编辑。
- 仅清理了确认无 HTML/JS 引用的 `.bill-line`、`.bill-empty-side` 旧规则。仍承担布局和响应式职责的兼容规则继续保留。

## 妙想内部页面（参考图 30）

- `ideas.css` 追加同一 `components` 层，所有样式限定在妙想页面、妙想组件或其独立弹层；不更改公共 Token、五导航、首页卡片或记录入口。
- `ideas-ui.js` 不直接访问存储或网络。卡片、详情、选择、排序和面板调用 `LifeIcons` / `LifeUI`，数据通过 app.js 回调读取与保存，不建立第二套数据源。
- 原 `#daily-notes`、`#note/<id>` 保留。`#ideas/search`、`#ideas/menu`、`#ideas/select`、`#ideas/write` 是同一模块的子状态，均使用现有 `openUiPage`、`returnUiPage`、`replaceUiRoute` 和 `lifeReturn`。菜单切换到搜索/选择/编辑时替换当前菜单条目，保留真正来源。
- 使用原 AppHeader 的返回按钮、居中标题和右侧空槽，添加妙想专用菜单/搜索按钮。其他页面的公共返回组件实现与视觉不变。
- 输入面板移动原 `diary-form`，保留原控件 ID、标签逻辑、字段校验和记录保存。保存后由路由关闭面板，不提前隐藏原折叠容器中的必填框，避免重复提交时浏览器无法聚焦校验控件。
- `ideas`、`ideaContext` 只属于 History 查看快照，保存排序、展开、选择和当前标签页草稿；不增加业务字段，不进入 JSON。来源、媒体和编辑时间没有虚构字段或默认推断。
- 视口变化只给妙想输入面板设置 `visualViewport` 高度/底部偏移；16px 输入和原生 dialog 焦点约束沿用原系统。桌面缩小视口模拟不能代替真实 iPhone 键盘验收。
- 多选删除复用原确认 Modal 和事务写入，在确认后再次核对选中的记录及标签。与其他模块数据无关，不新增无确认删除入口。
