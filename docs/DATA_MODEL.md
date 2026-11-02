# Life OS — DATA_MODEL

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

## 当前存储与目标模型边界

当前 app.js 及模块使用十个 localStorage 键、妙想 IndexedDB 和 JSON v11；无账号级隔离。主键示例 my-life-dashboard-v1、my-life-dashboard-personal-v1、my-life-dashboard-categories-v1。IndexedDB 有 assets、drafts、pendingSaves。现有 Notion 代理仅定义 operations(id TEXT PRIMARY KEY, digest TEXT NOT NULL, state TEXT NOT NULL, page_id TEXT)，是操作日志，不是生活数据表。未读取真实数据库或用户记录。

以下全部是目标逻辑结构，未生成 DDL/迁移、未建表。SQLite 开发、PostgreSQL 生产；UUID 在 SQLite 可存 TEXT，生产可用 UUID；时间统一 UTC 并保存用户 IANA 时区，业务日期单独 DATE。金额用整数最小货币单位并保留 USD。未标 ? 的字段必须非空；? 表示可空。所有用户所属表统一 id PK、user_id FK users.id、created_at、updated_at、version INT 默认1，必要 deleted_at?；建立 UNIQUE(user_id,id)。

## 表、字段、关系与索引（目标）

| 表 | 业务字段（除公共字段） | 关系/约束/索引 |
| --- | --- | --- |
| users | id、status、role、timezone、created_at、updated_at | role=user/admin；停用拒绝新会话 |
| identities | provider、subject、verified_at? | UNIQUE(provider,subject)；user_id 索引；不存明文密码 |
| sessions | token_hash、expires_at、revoked_at? | token_hash UNIQUE；(user_id,expires_at) |
| invitations | token_hash、inviter_id、expires_at、max_uses、used_count、revoked_at? | token_hash UNIQUE；次数检查；兑换事务锁；管理员所有 |
| invitation_redemptions | invitation_id、redeemed_at | UNIQUE(invitation_id,user_id)；FK invitation |
| profiles | display_name、preferences_json | UNIQUE(user_id)；偏好字段白名单 |
| consents | scope、policy_version、granted_at、revoked_at? | (user_id,scope)；保留授权变更证据 |
| schedules | title、business_date、start_at?、end_at?、status、notes?、legacy_id? | (user_id,business_date,status)；end大于start |
| schedule_drafts | title、start_at、end_at、timezone、status、expires_at、confirmed_schedule_id?、idempotency_key | UNIQUE(user_id,idempotency_key)；状态draft/confirmed/rejected/expired |
| learning_records | schedule_id?、business_date、minutes、content、legacy_id? | minutes非负；(user_id,business_date) |
| habits | name、active | (user_id,active) |
| habit_checkins | habit_id、business_date | UNIQUE(user_id,habit_id,business_date) |
| goals | title、due_date?、status、notes? | (user_id,status,due_date) |
| finance_records | business_date、income_minor、expense_minor、currency、category_snapshot?、legacy_id? | 非负整数；保留旧混合收支；(user_id,business_date) |
| health_records | metric、value_json、unit、measured_at、source、source_record_id? | (user_id,metric,measured_at)；来源防重；敏感范围单独授权 |
| notes | title、body、source、remote_id?、remote_revision? | (user_id,updated_at)；远端绑定限定本人 |
| ideas | body、tags_json、business_date、legacy_id? | (user_id,business_date)；媒体另表 |
| media_assets | owner_type、owner_id、storage_key、mime、size、checksum | storage_key UNIQUE；下载也验所有权；不暴露永久公开地址 |
| daily_reviews | business_date、summary、linked_record_ids_json | UNIQUE(user_id,business_date)；引用用于展示，不重复计账 |
| conversations | title、status | (user_id,updated_at) |
| messages | conversation_id、role、content、sequence | UNIQUE(user_id,conversation_id,sequence) |
| personal_memories | kind、content、source_message_id?、source_record_ref?、confidence、valid_from、expires_at?、consent_id、status | (user_id,status,kind)；检索先隔离再排序；向量索引候选 |
| ai_runs | conversation_id、status、model_config_ref、started_at、ended_at?、error_code? | (user_id,status,started_at) |
| tool_calls | run_id、tool_name、args_hash、status、idempotency_key、result_ref? | UNIQUE(user_id,idempotency_key) |
| approvals | tool_call_id、payload_hash、expires_at、decision、decided_at? | 绑定用户/参数版本；变更后重新确认 |
| scheduled_jobs | kind、timezone、next_run_at、enabled、last_run_key? | (enabled,next_run_at)；运行键防重 |
| audit_events | action、resource_type、resource_id?、outcome、request_id | (user_id,created_at)；不存正文、提示词或密钥 |

身份、邀请表按其职责使用公共字段的适用子集，users 无自指 user_id。其他跨表关联必须用 (user_id, referenced_id) 复合外键或同等服务端事务校验，禁止只验证 UUID 存在。自由 JSON 引用必须逐项验所有权，不能绕过外键规则。预算、分类、资产及重复模板等旧模块侧表迁移映射后续专项设计，未完成前不得替换现有存储。

## 隔离、生命周期与迁移

后端认证上下文注入 user_id，忽略模型/客户端指定的所有者；读取、更新、删除、搜索、导出、日志和任务执行全链路限定用户。生产 PostgreSQL RLS 可作为防御层候选，不能替代应用授权；连接池上下文不得串号。管理员默认无私有正文权限。A/B 用户猜测 ID、跨表关联、缓存、SSE、记忆检索均须负向测试。

草稿确认在事务中校验本人、版本、有效期和授权，生成 schedules 并标记 confirmed；唯一幂等键防重复。记忆可撤回、纠正、删除；删除同步清理检索索引和缓存；业务记录更新使相关记忆失效或重建，不能反向改写业务事实。注销、备份到期删除及审计留存期限须经实际业务和专业意见确定，不无限保留。用户明确授权后才开展旧 JSON 预览导入，保留原 ID 映射与备份，失败回滚，不批量自动迁移。

## 2026-11-02 GitHub同步审计

本轮仅归档现有正式代码、七份核心文档、开发团队配置和Skills；不实现目标后端/AI、不改变存储或用户数据、不部署。同步前HEAD为7cdfe58，后续提交以[同步报告](LIFEOS_GITHUB_SYNC_REPORT.md)及Git记录为准。

Scanner/Reviewer独立只读会话权限预检因请求超时未完成，未派发该角色或宣称隔离生效；用户明确允许本轮由主控扫描、文档维护、Diff复核及正常提交推送。配置TOML和Skill frontmatter可解析，不等于Agent端到端运行验收。此为本轮例外，不改AGENTS默认规则。

当前本地模块/PWA/Notion代理有代码证据；邀请账号、跨用户隔离、DeepSeek、AI记忆、三个产品AI工具、SSE与APScheduler仍未开始实现。实际检查、未测项、版本和下一步见[同步报告](LIFEOS_GITHUB_SYNC_REPORT.md)、[扫描报告](LIFEOS_PROJECT_SCAN_REPORT.md)及[更新记录](CHANGELOG.md)。历史“本次仅七文档/未提交”等段落只描述其原任务。
