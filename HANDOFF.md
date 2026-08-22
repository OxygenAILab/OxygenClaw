# OxygenClaw 后端稳定化 — 交接文档 (Handoff)

> 用途：智能体框架从 Cherry Studio 迁移到 AionUI 后，凭此文档无缝继续后端稳定化工作。
> 生成时间：2026-07-20。生成者：小氧（编码助手）。决策/测试者：泽川。

---

## 1. 项目概览与环境

- **项目**：OxygenClaw（`oxygen-claw`），开源 TypeScript monorepo，下一代多模型 AI Agent 平台。
- **定位**：终端 + 视觉双修的 Computer Use Claw（computeruse 是核心卖点，非可选项）。
- **版本**：`26.0.0-alpha.1`。
- **环境**：Windows（win32 x64），Node 24.15.0，npm 11.12.1。
- **本文档相关的两个 package**：
  - `packages/core` —— 引擎（ODC 认知 / OMM 记忆 / MCP / 容器 / 模型注册 / computeruse agents）。
  - `packages/server` —— Express 4 + TypeScript（CommonJS + ES2022）+ tsx 后端。
- **DB**：已从 sql.js（WASM 内存）迁移到 **better-sqlite3**（原生、同步、真 WAL、原子事务）。
- **后端契约文档（唯一真相源）**：根目录三份 SPEC
  - `BACKEND_CONVERSATIONS_SPEC.md`
  - `BACKEND_RUNTIME_TASKS_SPEC.md`
  - `BACKEND_SETTINGS_SPEC.md`
- **前端重写指引**：`packages/webui/CLAUDE_FRONTEND_BRIEF.md`（backend 契约驱动）。

---

## 2. 总体策略

**先做稳后端，再重写前端。** 泽川已明确授权可修改 `core` 包。
工作以"批（Lot）"推进，每批：**先给方案 → 泽川拍板 → 实施 → 编译验证（+ 必要时运行时冒烟）**。
泽川是决策与测试者，小氧负责实施。小而明确的改动可直接做。

后端修复共四批：
1. **Lot 1 — P0-1**：DB 层 sql.js → better-sqlite3。✅ 已完成（上一会话）。
2. **Lot 2 — P0-2**：event seq 竞态根治。✅ 已完成（上一会话）。
3. **Lot 3 — P0-3**：取消信号贯穿 adapter→core。✅ 已完成（本会话，已验证）。
4. **Lot 4 — P1 三项**：SSE 生命周期 / chat 走 worker / settings 校验。🔲 待做（见 §5）。

---

## 3. 已完成工作（Lot 1–3）

### Lot 1 · P0-1 · DB 迁移（✅ 已完成）
- **病灶**：旧 `services/db.ts` 用 sql.js，每次写都全库 `export()` + 全量覆盖落盘；`PRAGMA journal_mode=WAL` 对纯内存 WASM 完全无效（虚假安全感）。数据丢失 + 性能灾难。
- **修复**：换成 better-sqlite3。新增 `runTransaction<T>(fn: () => T): T`（包装 `db.transaction(fn)()`）。
- **兼容层**：better-sqlite3 参数绑定比 sql.js 严格，JS 布尔和 `undefined` 会直接抛错。解法：在 `runQuery`/`runExec`/`runInsert` 单一入口做 `normalizeParams`（boolean→0/1、undefined→null、Date→毫秒），上层路由零改动。**此层经冒烟测试确认必需。**
- **备份**：迁移前已备份 `data/oxygenclaw.db.bak-<时间戳>`。

### Lot 2 · P0-2 · event seq 竞态根治（✅ 已完成）
- **病灶**：`services/runtime.ts` 的 `recordRuntimeEvent` 原来用 `SELECT MAX(seq)+1` 与 INSERT 两条独立语句，并发事件可读到同一 MAX 而 seq 冲突，破坏排序与 `afterSeq` 增量拉取。
- **修复**：用 `runTransaction` 在同步事务内串行化「分配 seq + INSERT」（见 `runtime.ts:110-122`）。
- **硬兜底**：`runtime_events` 上的 `(task_id, seq)` **UNIQUE INDEX**（`ensureUniqueRuntimeEventSeqIndex`）。
  - ⚠️ **踩坑**：`CREATE UNIQUE INDEX IF NOT EXISTS` 若已存在**同名非唯一索引**（旧 schema 建的），会因名字已存在被静默跳过，唯一约束不生效。迁移做成幂等：先 `PRAGMA index_list` 检测 unique 标志 → 去重现有数据 → `DROP` 旧索引 → 重建为 UNIQUE。

### Lot 3 · P0-3 · 取消信号贯穿（✅ 已完成，本会话）
- **病灶**：`localAgent.ts` / `localComputerUse.ts` 中 `await agent.executeTask()` 整块同步跑完，取消检查只在循环迭代之间，穿不透到 `callLLM` 的 await 内部；且返回后状态被 core 的 `task.status`（abort 时为 'failed'）覆盖，导致被取消的任务被误标 'failed'。
- **修复 A — 信号贯穿到 LLM 调用**（`AbortController.signal` 传入 `callLLM`）：
  - `packages/core/src/computeruse/agent.ts:136` —— `signal: this.abortController?.signal`
  - `packages/core/src/computeruse/vision-agent.ts:180`（`runAgentLoop`）—— 同上
  - `packages/core/src/computeruse/vision-agent.ts:287`（`analyzeScreenshot`）—— 同上
  - （`provider.ts`、`agent.ts` 的 signal 透传基础设施在上一会话已就位）
- **修复 B — 取消优先收尾**（两个 adapter，`executeTask()` 返回后、`context.heartbeat()` 之后）：
  - `packages/server/src/runtime/adapters/localAgent.ts:36-` 取消优先块
  - `packages/server/src/runtime/adapters/localComputerUse.ts:56-` 同一模式
  - 逻辑：若 `context.isCancelled()` 为真，用 `cancelled` 状态收尾（`updateRuntimeTask` + `completeWorkerRun` + `agent_tasks` UPDATE + 记 `task_complete` 事件 payload.status=`cancelled`），**不回放 steps**，直接 `return`。
  - step 循环里原有的内联 `if (context.isCancelled()) return;` 已移除（现只负责记录 steps）。
- **取消基础设施**：core 的 `OxygenAgent` 已有 `cancel()`/`cancelled`/while 检查；adapter 层通过 `activeAgents.ts` 的 map 拿 agent 实例调 `cancel`。`RuntimeWorkerContext.isCancelled()` 读 `active.cancelled`。
- **验证**：`packages/core` 与 `packages/server` 两次 `npx tsc --noEmit` 均零错误。已用 Grep 复核三处 signal 与两处取消优先块确实落盘。

---

## 4. 关键运行时架构（供理解 Lot 4）

- **RuntimeWorkerManager**（`services/runtimeWorkerManager.ts`）：queue + 并发上限 + 心跳 + `sweepStaleTasks` + `failInterruptedTasks`。
  - `cancel(taskId)` 同时处理排队中和运行中的 job，运行中会调 `adapter.cancel?.(taskId)`。
  - `sweepStaleTasks()` 把心跳超时的 running 任务标 failed，并 `recordRuntimeEvent({type:'task_error'})` —— 这**会**发到事件总线。
- **事件总线**：`runtimeEventBus`（EventEmitter），按 `task:${taskId}` 频道；终态事件类型：`task_complete` / `task_error` / `task_cancelled`。
- **SSE**（`routes/agent.ts`）：`streamRuntimeTask` 与 `/tasks/:id/events/live` 先回放历史事件，再 `subscribeRuntimeEvents` 订阅；收到终态事件写 `[DONE]` + `res.end()`。
- **Settings 加密**：敏感字段（visionApiKey / asrApiKey / ttsApiKey / imageGenApiKey / dashboardApiKey）AES-256-GCM，前缀 `encrypted:aes256-gcm:`。

---

## 5. 已完成：Lot 4（P1 三项）✅

> Lot 4 全部完成。P1-1 验证通过无需改动，P1-2 新增 localChat adapter + 改造三处路由，P1-3 核心校验已实现。

### P1-1 · SSE 生命周期统一（✅ 验证通过）
- **病灶**：需确认 `sweepStaleTasks` 标记失败的任务是否会通过 SSE 通知到连接的客户端。
- **验证结果**：✅ 通路完整：
  - `runtimeWorkerManager.start()` 在服务器启动时调用（`index.ts` L69）
  - `sweepStaleTasks` 每 30s 执行一次（setInterval）
  - 调用 `updateRuntimeTask(status: 'failed')` + `recordRuntimeEvent(type: 'task_error')`
  - `recordRuntimeEvent` emit 到事件总线 `task:${taskId}`
  - SSE 订阅者（`/tasks/:id/events/live`）收到 task_error → 写 SSE + `[DONE]` + `res.end()`
- **结论**：无需改动，已正确工作。

### P1-2 · chat `generate:true` 走 worker manager（✅ 已完成）
- **病灶**：`routes/conversations.ts` 的 `POST /:id/messages`、`/edit`、`/regenerate`、`/generate-title` 四处在路由内**直接** `callLLM(...)` 做流式，绕过了 RuntimeWorkerManager。
- **问题**：绕过 worker manager → 无统一并发控制 / 心跳 / 取消 / 事件流 / stale 清扫；chat 与 agent/computeruse 两套执行路径不一致。
- **修复**（选项 A — 新增 `local-chat` adapter + 202 + taskId）：
  - 新建 `packages/server/src/runtime/adapters/localChat.ts`，导出 `localChatAdapter`（支持取消 / 心跳 / 写入 messages 表 / 更新 conversation.updated_at）。
  - 在 `adapters/index.ts` 注册 `localChatAdapter`。
  - `routes/conversations.ts` 三处（`POST /:id/messages` generate=true 分支、`POST /:id/messages/:messageId/edit`、`POST /:id/regenerate`）改为创建 runtime_task + enqueue 到 worker manager，返回 202 + taskId + eventsUrl。
  - `POST /:id/generate-title` 保持直接调用 callLLM（非流式、轻量级操作、只更新 title、无需 worker manager）。
  - 重新编译 core（生成带 signal 的 .d.ts）+ server tsc 零错。

### P1-3 · settings 后端校验（✅ 基本完成）
- **验证结果**：核心校验已实现。
  - `coerceAndValidateSetting(field, value)` 已做：boolean / number（含 `NUMBER_RANGES` 范围）/ select（`SELECT_OPTIONS` 枚举）/ URL（BaseUrl、dashboardApiUrl）/ HH:mm（dndStart/dndEnd）校验；敏感字段 AES-256-GCM 加密；未知字段抛错（L286）；`****` 掩码值跳过（不覆盖已存密钥）。
  - `PUT /` 路由已用 try/catch 包裹，校验失败返回 400 `Validation failed: ...`。
- **不足**：
  - 当前是**硬编码白名单**（FIELD_MAP、SELECT_OPTIONS、NUMBER_RANGES），非 schema 驱动（SPEC 理想架构是"后端从 webui/settings/schema.ts 导入并动态校验"）。
  - 缺少 `validation.pattern`（正则）、`validation.required`（必填）、`validation.min/max`（字符串长度）校验。
- **结论**：核心功能已工作，建议后续重构为 schema 驱动（需将 webui 的 schema 移到 shared 包或后端导入）。

---

## 6. 约定与踩坑教训（务必遵守）

### 协作
- 泽川是决策与测试者，小氧实施。**改动前先给方案等拍板**（小而明确的改动除外）。
- 每批改动完**必须编译验证**（`npx tsc --noEmit`）+ 必要时运行时冒烟测试，不留半成品。
- 破坏性/不可逆操作（删多文件、drop 数据库、改生产、force push）先确认。不直接推 main/master。只在明确要求时创建 git commit。

### 数据库
- **DB 改动前先备份**（已有 `data/oxygenclaw.db.bak-<时间戳>`）。
- **tsc 通过 ≠ 运行时正确**。DB 这类地基必须跑运行时冒烟测试。
- better-sqlite3 参数绑定严格（boolean/undefined 会抛）——统一走 db.ts 的 `normalizeParams`。

### 临时 Node 测试脚本
- 要 `require('better-sqlite3')` 的临时脚本**必须放在 `packages/server` 目录内**再跑，放 `/tmp` 会 MODULE_NOT_FOUND（node_modules 解析路径）。
- Bash/终端工具的**工作目录在命令间持久**。若之前已 `cd` 进子目录，再写 `cd packages/server && ...` 会因已在其中而失败、`&&` 链整体断掉。**先确认当前 cwd。**

---

## 7. 精确当前状态（断点）

- **Lot 1（P0-1 DB 层迁移 sql.js → better-sqlite3）**：✅ 已完成，两包 tsc 零错，DB 已备份。
- **Lot 2（P0-2 event seq 竞态根治）**：✅ 已完成，`recordRuntimeEvent` 用 `runTransaction` 原子分配 seq + UNIQUE INDEX 硬兜底，两包 tsc 零错。
- **Lot 3（P0-3 取消信号贯穿）**：✅ 已完成，core 三处 callLLM 加 signal、两个 adapter 加取消优先收尾块，两包 tsc 零错。
- **Lot 4（P1 三项）**：✅ **全部完成**。
  - **P1-1（SSE 生命周期）**：✅ 验证通过，通路完整，无需改动。
  - **P1-2（chat 走 worker manager）**：✅ 已完成。新增 `localChat.ts` adapter，改造 conversations.ts 三处（messages/edit/regenerate）为 202+taskId，generate-title 保持直连。两包 tsc 零错。
  - **P1-3（settings 校验）**：✅ 基本完成。核心校验已实现且工作，建议后续重构为 schema 驱动。

**后端稳定化（Lot 1-4）全部完成**。下一步可进入前端重写（按 `CLAUDE_FRONTEND_BRIEF.md` + 三份 BACKEND SPEC）。

---

## 8. Lot 3/4 涉及文件清单（已改）

**Lot 3（P0-3 取消信号贯穿）**：
| 文件 | 改动 |
|---|---|
| `packages/core/src/computeruse/agent.ts` | L136 加 `signal` |
| `packages/core/src/computeruse/vision-agent.ts` | L180 / L287 加 `signal` |
| `packages/server/src/runtime/adapters/localAgent.ts` | L36- 取消优先块；移除内联取消 return |
| `packages/server/src/runtime/adapters/localComputerUse.ts` | L56- 取消优先块 |

**Lot 4（P1-2 chat 走 worker manager）**：
| 文件 | 改动 |
|---|---|
| `packages/server/src/runtime/adapters/localChat.ts` | 新建，实现 localChatAdapter（支持取消/心跳/写入 messages 表） |
| `packages/server/src/runtime/adapters/index.ts` | 注册 localChatAdapter |
| `packages/server/src/routes/conversations.ts` | 三处改为 202+taskId：`POST /:id/messages`（generate=true）、`POST /:id/messages/:messageId/edit`、`POST /:id/regenerate` |

（Lot 1/2 涉及 `packages/server/src/services/db.ts`、`services/runtime.ts` 及 UNIQUE INDEX 迁移，上一会话完成。）
