# Life OS — CODEX_TECH_STACK_AND_TOOLING

更新：2026-11-02。状态口径：**当前已实现**仅表示代码存在；**已确认决策**表示产品方向；**目标架构**尚待实施；**待验证**不得作为上线事实。本文当前基线优先于下方历史快照；历史内容保留，不代表再次授权开发或测试通过。

邀请制测试 B：管理员邀请少量朋友，每人独立账号、业务数据、AI 对话和记忆。AI 是生活管理协调中心，业务模块仍是业务数据真实来源。Codex 仅用于辅助开发，不属于产品运行时。密钥只通过安全环境变量/密钥管理注入，禁止提交 Git。

## 文档索引

- [PRD](PRD.md)
- [ARCHITECTURE](ARCHITECTURE.md)
- [CODEX_WORK_ENVIRONMENT](CODEX_WORK_ENVIRONMENT.md)
- [CODEX_TECH_STACK_AND_TOOLING](CODEX_TECH_STACK_AND_TOOLING.md)
- [DATA_MODEL](DATA_MODEL.md)
- [AI_AGENT_SPEC](AI_AGENT_SPEC.md)
- [DEVELOPMENT_PROGRESS](DEVELOPMENT_PROGRESS.md)

## 技术状态与工具清单

| 层/工具 | 当前证据 | 已确认方向或待验证 |
| --- | --- | --- |
| 前端 | 原生 HTML/CSS/JavaScript、Hash/History | 保留 UI；SSE 为目标，未接通 |
| 编辑器/OCR | vendor 清单 Quill 2.0.3、Tesseract.js 7.0.0 | 固定本地资源；不擅自升级 |
| 本地数据 | localStorage、IndexedDB、JSON v11 | 保留兼容与恢复 |
| Python 服务 | http.server、urllib、sqlite3 标准库 | FastAPI 优先评估，未安装/接入结论 |
| 关系数据库 | Notion 代理 operations 日志代码 | 全站 SQLite 开发、PostgreSQL 生产为目标 |
| AI | 未发现产品集成 | DeepSeek API 已确认方向；模型 ID、价格、SDK/API 兼容性待验证 |
| 工具执行 | 尚未实施 | 后端 Function Calling 白名单 |
| 调度 | 尚未实施 | APScheduler 方向已确认；版本、持久化、多进程策略待验证 |
| PWA | manifest、SW、安装脚本存在 | 实机、推送与离线隐私边界待验证 |
| 认证 | 尚无产品身份系统 | Supabase Auth/国内服务/自建均候选；可达性、邮件、区域、成本及安全待验证 |
| 部署 | 历史 Sites 报告 | 云厂商未选；Sites 动态后端/SSE/调度兼容性待验证 |
| 开发 | Git、PowerShell、Python、Node 脚本 | Codex 仅辅助；不属于运行时 |

审计使用 Git 状态/日志/diff、文件检索、Python 哈希与 Markdown 检查；没有运行 npm 安装或新增依赖。后续候选工具：数据库迁移工具、HTTP/API 测试、隔离浏览器测试、类型/格式检查；版本和命令需依据届时实际清单确定，不虚构统一构建命令。

不引用未经核验的套餐额度、模型名称或费用；DeepSeek 的 Function Calling、流式事件格式、超时和错误语义应使用届时官方资料及隔离集成测试确认。中国大陆处理要求见 PRD，上线核验未完成，不宣称合规。Notion 真实连接、模型调用及云部署均未在本次测试。


## 历史原文快照（非当前决策）

原始 SHA-256：`342c7af72412c9ee4dcdda0c9747678844b5441b41043d3d41ee93f31ed58a6c`。以下原始内容逐字节保留；与当前基线冲突时以本文前部为准。

<!-- ORIGINAL_BYTES_START -->
# Life OS — 技术栈与工具清单

## 本次核实与状态边界（2026-11-02）

以下审计说明优先于后续初稿中的目标性描述。后续关于账号、后端、数据库和 AI 的“必须”“采用”表示未来实现要求，不表示已实现或已接通。

- **已确认**：B 邀请制测试；本人及少量受邀用户各自拥有独立账号、业务数据、对话和 AI 记忆；中国大陆第一阶段；Codex 仅辅助开发，不进入产品运行时。管理员数量和具体邀请流程仍是方案。
- **当前实际检测到**：仓库为 `D:/CODEX/Life OS`，分支 `main`，HEAD `7cdfe58`。开工已有13个跟踪文件修改及多项未跟踪文件，包含 PRD、架构和业务代码；本次保留全部既有修改。
- **当前实际检测到**：原生 HTML/CSS/JavaScript 静态单页，Hash/History 路由，localStorage 与 IndexedDB；无项目根 package.json、统一 npm 构建链或项目级依赖锁文件。vendor 内的 package.json 是随附资源元数据，不是项目依赖安装清单。
- **当前实际检测到**：Quill 2.0.3、Tesseract.js/core 7.0.0、中文 fast 模型4.1.0，参见 [第三方资源](THIRD-PARTY.md) 与 vendor/MANIFEST.json；本次没有重跑全部资源摘要验证。
- **当前实际检测到**：Python 标准库本机 Notion 代理已存在，使用 sqlite3 保存操作日志，不等于 Life OS 多用户业务数据库。真实 Notion 连接未验证。manifest、pwa.js、sw.js 和静态导出脚本存在。
- **当前实际检测到**：本机 Node.js v24.12.0、Python 3.14.2、Git 2.55.0.windows.5；这是检测结果，不是生产版本要求。未安装依赖或核验全局包，未读取密钥值。
- **目标选型**：FastAPI 优先、Node.js 可替代；SQLite 开发与 PostgreSQL 上线、SQLAlchemy/Alembic、DeepSeek、SSE、Function Calling、APScheduler 均非已落地的多用户 AI 系统。
- **待验证**：认证服务、云厂商、数据区域、模型 ID、价格、SDK/API 能力（尤其 Responses API）、部署兼容性和生产版本。不得直接沿用聊天中的额度、价格或服务能力承诺。
- 现有 [PRD](PRD.md) 与 [实际架构](ARCHITECTURE.md) 仍记录本地单人实现，和新产品目标存在阶段差异；本次不修改它们。已有进度采用 [STATUS](STATUS.md)，不另建 DEVELOPMENT_PROGRESS.md；DATA_MODEL.md、AI_AGENT_SPEC.md 等仅是未来建议。
- [PWA/Sites 报告](PWA-SITES-REPORT-20261027.md) 记录历史私密发布，不能据此宣称本次在线验证成功。Sites 的 FastAPI/Python、数据库连接及持久存储、后台调度、SSE 超时/缓冲、跨域认证与 Service Worker scope/MIME/认证后离线行为必须实测；必要时评估独立后端，未确定部署方案。

### 中国大陆开放前核验清单（待验证，不构成合规结论）

记录账号、业务数据、AI记忆、日志、备份与供应商处理区域及子处理者；优先评估大陆区域，但不得把它写成已经部署。整理个人信息收集目的、最小必要字段、保存期限、告知/同意及撤回、导出、纠正、删除、注销流程。健康、金融账户等可能涉及敏感个人信息，须逐项核实分类、必要性、适用的单独同意和影响评估要求。

跨境核验涵盖模型提示词、Notion、认证邮件、遥测、备份与境外运维访问；查明接收方、处理目的及适用机制，不能仅凭API品牌或服务器所在地判断。按实际运营模式核验个人信息保护、数据安全、网络安全、网站/域名及未来App备案、生成式AI服务适用范围、内容治理、生成内容标识及可能的备案/安全评估义务。邀请制不自动等于豁免；开放前应由负责人依据届时官方规则及必要专业意见确认。本次只记录核验任务，未开展法律核验或连接外部服务。

### 本次工作范围与验收

本次只新增这两份文档。用户明确限制优先于 AGENTS.md 日常更新 STATUS 的要求，故不更新 STATUS、PRD、ARCHITECTURE。没有运行网站、数据库、AI、真实账号或部署测试；历史通过数不计入本次结果。只检查文档结构、相互引用、路径和文件变更范围。密钥只通过安全环境变量或密钥管理注入，禁止写入代码、日志、前端或提交 Git；本次不创建任何真实密钥或配置。

配套文档：[Codex 工作环境规范](CODEX_WORK_ENVIRONMENT.md)。

## 初稿整理后的工作规范与目标方案


**项目名称：** Life OS  
**产品定位：** AI 驱动的个人生活管理操作系统  
**产品阶段：** 邀请制测试  
**目标市场：** 中国大陆优先  
**文档版本：** 1.0  
**文档状态：** 目标技术选型与待验证清单

---

## 1. 文档目的

本文件用于告诉 Codex：

- Life OS 使用什么技术。
- 哪些技术已经确定。
- 哪些技术是优先候选。
- 哪些技术仍需验证。
- 开发环境需要哪些工具。
- 正式运行环境需要哪些服务。
- 各项工具如何协同工作。

特别注意：

本文件区分三种状态：

- **已确认：** 产品方向或技术决策已经确定。
- **目标选型：** 计划采用，但尚不代表已经部署。
- **待验证：** 需要结合当前项目和实际服务能力确认。

Codex 必须检查真实代码和依赖文件，不得把目标技术栈当作已经实现的技术栈。

## 2. 产品与部署方向

### 2.1 产品模式

当前采用 B：邀请制测试。

- 管理员管理邀请资格。
- 少量测试用户注册。
- 每个用户有独立账号。
- 每个用户有独立生活数据。
- 每个用户有独立 AI 对话。
- 每个用户有独立 AI 记忆。
- 不同用户的数据必须隔离。

未来可以扩展为公开注册，但当前不开发大规模商业运营体系。

### 2.2 产品核心理念

Life OS 以 AI 为核心驱动生活管理。

核心能力：

1. 感知用户请求。
2. 理解用户需求。
3. 检索个人记忆。
4. 获取授权的生活数据。
5. 制定计划。
6. 调用业务工具。
7. 验证执行结果。
8. 根据反馈持续调整。

AI 是协调中心，各业务模块仍然负责保存真实业务数据。

### 2.3 中国大陆优先

正式测试用户主要面向中国大陆。

优先评估：

- 中国大陆部署区域。
- 国内可用的身份认证。
- 国内数据库和对象存储。
- DeepSeek API。
- HTTPS 和域名配置。
- 个人信息保护要求。
- 数据跨境处理要求。
- 网站及 AI 服务合规要求。

## 3. 前端技术栈

### 3.1 现有 UI

**状态：已确认保留现有 UI。**

Codex 必须先检测当前框架和组件体系。

不允许在没有必要的情况下重写前端。

### 3.2 SSE 流式通信

**状态：目标选型。**

前端通过 SSE 接收 AI 流式回复。

建议接口：

`POST /api/chat`

如果使用浏览器 fetch POST：

- 使用 fetch 发起请求。
- 使用 ReadableStream 读取响应。
- 解析 SSE 事件。
- 处理连接中断。
- 支持用户取消请求。
- 支持错误事件。
- 支持工具执行状态事件。

浏览器原生 EventSource 不直接支持 POST 请求，因此不要错误地把 EventSource 用作 POST 流式请求客户端。

### 3.3 登录页面

由 Codex 根据现有 UI 规范开发。

初期包含：

- 登录页面。
- 注册页面。
- 邀请码验证。
- 邮箱验证。
- 登录状态。
- 退出登录。
- 找回或恢复账号的适用流程。

界面必须符合 Life OS 当前的苹果风格。

### 3.4 PWA

**状态：产品方向已确认，实际支持情况待验证。**

要求：

- Web App Manifest。
- Service Worker。
- iPhone 主屏幕安装。
- HTTPS。
- 安全区域适配。
- 离线基础能力。
- 应用更新机制。

PWA 本地缓存与正式云端数据必须区分。

### 3.5 前端主要业务模块

保留现有模块：

- 首页。
- 助手。
- 日程。
- 学习。
- 习惯。
- 长期目标。
- 收支。
- 统计。
- 健康。
- 妙想。
- 社交。
- 笔记。
- 个人中心。

实际模块以当前项目为准，不得为了匹配清单而创建重复功能。

## 4. 后端技术栈

### 4.1 首选：FastAPI

**状态：优先目标选型。**

理由：

- Python AI 生态成熟。
- 支持异步请求。
- 支持 SSE 流式响应。
- 适合 Function Calling。
- 适合 AI 上下文管理。
- 适合后续复杂 Agent 工作流。

主要职责：

- 身份认证。
- API 请求处理。
- 用户权限验证。
- 生活数据业务服务。
- AI 模型调用。
- 工具注册与执行。
- 记忆检索。
- 定时任务。
- 数据库访问。
- 审计记录。

Node.js 是可接受的替代方案，但更换后端语言必须先评估部署和维护成本。

### 4.2 后端架构

优先采用模块化单体架构。

建议逻辑目录：

```text
backend/
├── app/
│   ├── api/
│   ├── core/
│   ├── auth/
│   ├── ai/
│   ├── memories/
│   ├── tools/
│   ├── services/
│   ├── models/
│   ├── repositories/
│   ├── database/
│   └── scheduler/
│
├── tests/
├── migrations/
├── requirements.txt
└── main.py
```

具体目录根据项目实际情况调整。

初期不使用微服务架构。

## 5. 数据库

### 5.1 开发环境：SQLite

**状态：目标选型。**

用途：

- 本地开发。
- 功能测试。
- 单元测试。
- 数据模型验证。

### 5.2 正式环境：PostgreSQL

**状态：目标选型。**

用途：

- 多用户数据存储。
- AI 对话。
- AI 记忆。
- 用户配置。
- 生活管理业务数据。
- 工具执行记录。
- 授权记录。

必须支持用户之间的数据隔离。

### 5.3 数据库迁移

建议使用 SQLAlchemy + Alembic，前提是最终采用 Python/FastAPI。

要求：

- 使用版本化迁移。
- 不直接手工修改生产数据库结构。
- 保留迁移记录。
- 支持回滚方案。
- SQLite 与 PostgreSQL 之间避免使用不兼容的数据类型或特性。
- 上线前执行真实 PostgreSQL 兼容性测试。

## 6. AI 模型与运行时

### 6.1 DeepSeek API

**状态：首选模型服务。**

官方 API 地址：

`https://api.deepseek.com`

建议使用 OpenAI Python SDK 兼容接口。

配置示例：

```python
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.environ["DEEPSEEK_API_KEY"],
    base_url="https://api.deepseek.com"
)
```

密钥只能由服务端读取。

不得将 API Key 写入前端。

### 6.2 模型选择

用户提出的候选模型：

- deepseek-flash
- deepseek-v4-pro

**具体模型 ID、可用能力和价格必须以开发时 DeepSeek 官方文档为准。**

不得硬编码未经验证的模型名称和价格。

建议通过环境变量配置模型：

- AI_DEFAULT_MODEL
- AI_ADVANCED_MODEL

### 6.3 AI Provider 抽象

建立统一模型调用接口。

```text
AI Provider
    |
    ├── DeepSeek
    |
    ├── OpenAI（未来候选）
    |
    └── 其他兼容服务
```

业务模块不应直接依赖某一个模型厂商的专有实现。

### 6.4 AI 成本控制

初期目标：

- 普通任务优先使用低成本模型。
- 复杂任务才使用高能力模型。
- 控制上下文长度。
- 只检索相关记忆。
- 避免重复发送完整聊天历史。
- 记录 Token 使用量。
- 统计每个用户的模型成本。

2000～3000 Tokens 是初期成本优化参考，不是硬性上下文上限。

实际价格随模型和服务政策变化，必须定期核验。

## 7. AI 工具调用

### 7.1 首期采用 Function Calling

**状态：已确定优先采用。**

暂时不建设复杂 MCP 体系。

模型只提出工具调用请求。

真正的工具执行必须发生在后端。

### 7.2 首期三个工具

**工具一：get_life_overview**

获取当前用户授权的今日生活概况。

包括：

- 日程。
- 学习情况。
- 习惯进度。
- 长期目标。

**工具二：search_personal_memory**

检索当前用户相关的历史记忆和个人偏好。

**工具三：create_schedule_draft**

根据 AI 规划创建待确认日程草稿。

用户确认后才正式写入日程模块。

### 7.3 工具安全

所有工具必须：

- 验证当前用户身份。
- 验证数据归属。
- 验证参数。
- 检查授权范围。
- 记录执行结果。
- 提供异常处理。

模型不得直接执行任意 SQL。

## 8. AI 记忆系统

记忆分为：

1. 用户档案。
2. 长期记忆。
3. 短期记忆。
4. 行为记忆。
5. 对话历史。

每条记忆必须具有：

- memory_id。
- user_id。
- 内容。
- 类型。
- 来源。
- 创建时间。
- 更新时间。
- 可选的重要程度。
- 用户授权或处理依据。
- 删除状态。

初期优先使用 PostgreSQL 结构化查询和全文搜索。

向量数据库暂不作为强制依赖。

后期根据实际记忆规模和检索质量再评估。

## 9. 核心数据库表

初期 AI 基础层建议六张核心表：

| 表名 | 主要用途 |
|---|---|
| user_profiles | 用户档案和偏好 |
| ai_conversations | AI 对话会话 |
| ai_messages | 对话消息 |
| ai_memories | 个人记忆 |
| ai_tool_runs | 工具调用记录 |
| privacy_consents | 隐私授权与撤回 |

建议增加：

`ai_usage_logs`

用于记录模型名称、Token、成本和请求状态。

认证服务自身的账号表与业务用户档案需要合理关联。

这六张表不是整个 Life OS 的全部业务数据表。

现有财务、学习、日程、健康等业务表继续独立维护。

## 10. 登录与身份认证

### 10.1 产品要求

邀请制测试必须支持：

- 管理员邀请。
- 邀请码或邀请链接。
- 用户注册。
- 邮箱验证。
- 登录。
- 退出。
- 会话管理。
- 用户身份隔离。

### 10.2 身份认证候选

Supabase Auth 是开发阶段可以评估的候选服务。

但正式面向中国大陆用户时，必须评估：

- 数据托管区域。
- 跨境处理。
- 邮件服务可用性。
- 邮箱送达能力。
- 访问延迟。
- 用户数据处理协议。
- 服务商合规条件。

优先评估中国大陆可用的身份认证方案，或者经过审查的自托管认证架构。

不要在未完成评估前，将 Supabase 认定为正式生产认证服务。

### 10.3 用户隔离

认证服务返回的稳定用户身份必须在后端验证。

业务数据库所有用户数据必须具有明确的归属。

绝不能通过前端传入的 user_id 决定数据访问权限。

## 11. 定时任务

**目标选型：APScheduler。**

首期计划：

- 每周生活回顾。
- 目标进度检查。
- 承诺到期提醒。
- 用户主动设置的提醒。

生产环境必须避免多个 Worker 重复执行相同任务。

初期建议独立运行一个调度实例。

后期根据规模评估持久化任务队列。

## 12. 订阅与支付

**状态：暂缓实施。**

未来候选：

国内：

- 微信支付。
- 支付宝。

海外：

- Stripe。

正式开发时必须实现：

- 服务端创建支付订单。
- Webhook 验签。
- 幂等处理。
- 订阅状态管理。
- 退款和取消流程。

禁止让前端直接修改用户订阅状态。

当前邀请制测试阶段不需要支付系统。

## 13. 开发工具清单

Codex 应根据实际环境检查和使用以下工具。

| 工具 | 用途 | 状态 |
|---|---|---|
| Codex | AI 辅助开发 | 已使用 |
| Git | 版本管理 | 已使用 |
| GitHub | 远程代码仓库 | 已使用 |
| Python | FastAPI 开发 | 目标 |
| FastAPI | 后端框架 | 优先选型 |
| SQLite | 本地开发数据库 | 目标 |
| PostgreSQL | 正式数据库 | 目标 |
| SQLAlchemy | ORM | 候选 |
| Alembic | 数据迁移 | 候选 |
| DeepSeek API | AI 模型 | 首选 |
| OpenAI SDK | API 客户端 | 候选 |
| APScheduler | 定时任务 | 目标 |
| pytest | 后端测试 | 目标 |
| Ruff | Python 代码检查 | 目标 |
| Docker | 环境部署 | 候选 |
| Chrome | 前端测试 | 已使用 |
| Playwright | 浏览器自动化测试 | 候选 |

Codex 必须先检查当前环境，避免重复安装已有工具。

## 14. 建议的环境变量

以下只定义变量名称，不包含真实密钥：

```env
APP_ENV=development
APP_SECRET_KEY=

DATABASE_URL=

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
AI_DEFAULT_MODEL=
AI_ADVANCED_MODEL=

AUTH_PROVIDER=
AUTH_SECRET=

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

FRONTEND_URL=
BACKEND_URL=

SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
```

具体变量根据最终选型调整。

禁止将真实 .env 文件提交 Git。

## 15. 中国大陆部署与合规要求

正式邀请测试之前，检查：

### 数据保护

- 个人信息处理目的。
- 数据收集最小化。
- 敏感个人信息授权。
- 用户数据隔离。
- 数据加密。
- 数据导出。
- 数据删除。
- 数据备份。
- 跨境处理评估。

### AI 服务

- DeepSeek 服务使用条件。
- 面向公众提供生成式 AI 服务时的适用要求。
- 相关模型备案或应用登记要求。
- AI 生成内容标识要求。
- 用户投诉和反馈机制。

### 网站运营

- 域名和 HTTPS。
- 网站备案适用要求。
- 服务器所在区域。
- 未来 App 备案。
- 经营性业务许可的适用性。

合规结论必须结合实际运营方式进行核验，不得仅凭技术配置判断合规。

## 16. 外部集成

未来可以接入：

| 服务 | 用途 | 当前状态 |
|---|---|---|
| Notion | 笔记与知识管理 | 本机代理已实现，真实连接待验证 |
| 小米手环 | 健康数据实验 | 规划中 |
| DeepSeek | AI 核心 | 首选 |
| 微信 | 登录或支付候选 | 待评估 |
| 支付宝 | 支付候选 | 待评估 |

外部集成必须采用独立服务接口。

不得让第三方服务直接访问所有 Life OS 用户数据。

涉及境外服务时，需要评估个人信息跨境处理问题。

## 17. 技术实施阶段

### 阶段 0：项目审计与架构确定

- 检查当前前端。
- 检查现有数据结构。
- 检查 PWA。
- 确定后端方案。
- 确定数据库。
- 确定认证服务。
- 完成 PRD 与 ARCHITECTURE。

### 阶段 1：邀请制多用户基础

- FastAPI。
- PostgreSQL。
- 身份认证。
- 邀请码。
- 用户资料。
- 用户数据隔离。
- 基础 API。

### 阶段 2：AI 核心

- DeepSeek 接入。
- SSE 对话。
- 会话管理。
- 用户上下文。
- 记忆存储。
- Token 统计。

### 阶段 3：AI 工具调用

- get_life_overview。
- search_personal_memory。
- create_schedule_draft。
- 用户确认机制。
- 工具执行验证。

### 阶段 4：主动生活管理

- 每日规划。
- 每周回顾。
- 目标跟踪。
- 定时任务。
- 用户授权提醒。

### 阶段 5：生态与商业化

- Notion。
- 健康设备。
- MCP。
- 多模型。
- 支付订阅。
- 公开注册。

## 18. Codex 必须遵守的技术决策原则

1. 真实代码优先于文档中的假设。
2. 已确认选型优先于未经确认的建议。
3. 未经用户同意，不更换主要技术栈。
4. 未经测试，不宣称集成成功。
5. 不允许将开发密钥写入前端。
6. 不允许不同用户共享私人数据。
7. 不允许 AI 绕过业务服务直接操作数据库。
8. 不允许为了增加 AI 能力破坏原有 Life OS 模块。
9. 新增依赖必须说明原因。
10. 重要架构变化必须同步更新文档。

---

## 19. 最终目标

Life OS 不是简单的 AI 聊天网站。

它是一个以用户身份为基础、以个人记忆为上下文、以业务模块为执行工具、以 AI 为协调核心的生活管理操作系统。

所有技术选型最终都应服务于：

**让 AI 理解每个用户独立的生活，帮助用户规划、执行、验证和改善自己的生活。**


## 2026-11-02 Codex 开发团队配置

实际仓库：`D:\CODEX\Life OS`；`D:\CODEX\gerenshenghuoguanliwangzhan` 为指向该目录的链接。复用现有仓库，不创建 LifeOS 副本。CLI 实测版本为 `0.165.0-alpha.1.2`。

配置位于 `.codex/config.toml` 与 `.codex/agents/{scanner,reviewer,builder}.toml`。采用独立文件的 name、description、developer_instructions 和 agents.enabled/max_concurrent_threads_per_session；模型继承会话，不固定模型、不增加业务依赖。

主控流程：记录 Git 基线及未跟踪文件 → Scanner 收集证据 → Reviewer 审查方案 → 重大决定交用户确认 → Builder 按范围实现和测试 → Reviewer 审查实际 Diff → 主控核验并中文交付。只有 Builder 写入，禁止多个写入者同时操作同一工作区。审批必须绑定 HEAD、工作区基线和具体 diff；发生变化重新审查。

统一交接：任务ID、仓库绝对路径、HEAD、工作区基线、目标、允许/禁止文件、用户授权及方案审批、证据路径与行号、发现和严重度、实际测试/未测项、风险、下一角色。主控负责传递完整交接，不把 Reviewer 的技术意见当作用户授权。

权限落实：官方明确子 Agent 继承父会话，Agent TOML 无法覆盖 sandbox_mode/approval_policy。Scanner 和 Reviewer 仅允许从独立只读父会话启动：`codex -C "D:\CODEX\Life OS" --sandbox read-only --ask-for-approval never`，在其中明确调用 scanner 或 reviewer。Builder 使用独立 workspace-write 会话，且与审查阶段串行。不得使用绕过权限参数；禁用可写外部连接器。普通 Git worktree 不是只读隔离。本次当前桌面会话权限为 unrestricted，不能用于声称 Scanner/Reviewer 已获得只读隔离；主控必须先核实新会话有效权限，无法核实时停止派发只读角色。当前仅完成配置落盘，未声称端到端 Agent 调用或 Windows 只读执行实测通过。

本次仅开发流程配置及文档追加，业务、数据库、依赖和密钥不变；未提交、推送、部署。保留原有未提交内容。官方依据：https://learn.chatgpt.com/docs/agent-configuration/subagents 。

## 2026-11-02 GitHub同步审计

本轮仅归档现有正式代码、七份核心文档、开发团队配置和Skills；不实现目标后端/AI、不改变存储或用户数据、不部署。同步前HEAD为7cdfe58，后续提交以[同步报告](LIFEOS_GITHUB_SYNC_REPORT.md)及Git记录为准。

Scanner/Reviewer独立只读会话权限预检因请求超时未完成，未派发该角色或宣称隔离生效；用户明确允许本轮由主控扫描、文档维护、Diff复核及正常提交推送。配置TOML和Skill frontmatter可解析，不等于Agent端到端运行验收。此为本轮例外，不改AGENTS默认规则。

当前本地模块/PWA/Notion代理有代码证据；邀请账号、跨用户隔离、DeepSeek、AI记忆、三个产品AI工具、SSE与APScheduler仍未开始实现。实际检查、未测项、版本和下一步见[同步报告](LIFEOS_GITHUB_SYNC_REPORT.md)、[扫描报告](LIFEOS_PROJECT_SCAN_REPORT.md)及[更新记录](CHANGELOG.md)。历史“本次仅七文档/未提交”等段落只描述其原任务。
