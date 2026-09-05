# CodeX Harness Research — Standard Usage Patterns

<!-- GitHub@NDBlockConnect | BlockConnect@StarsailsClover -->

> Study of `openai/codex` (codex-rs, cloned via gh-proxy, depth-1) to extract
> harness-level conventions applicable to the OxygenClaw × OpenOxygen Next
> "choose-your-harness" platform decision.
> 中文摘要见文末。

## 1. Repository topology (90+ Rust crates, workspace)

| Layer | Crates | Role |
|---|---|---|
| **Protocol** | `protocol`, `app-server-protocol`, `exec-server-protocol` | Typed contracts (`Submission`/`Event` queues, `ReviewDecision`, `SandboxPolicy`, `PermissionProfile`). TS bindings generated via `ts_rs` — **single source of truth shared with the TypeScript front-ends** |
| **Core** | `core` (session/turn/thread), `agent-identity`, `agent-roles`, `agent-graph-store` | Agent loop, session lifecycle (`codex_thread.rs`, `session/`), multi-agent graph |
| **Execution** | `exec`, `exec-server`, `shell-command`, `apply-patch`, `worktree` | Process execution, patch application, isolated worktrees |
| **Sandboxing** | `sandboxing`, `linux-sandbox`, `windows-sandbox-rs`, `windows-sandbox-service`, `execpolicy`, `process-hardening`, `network-proxy` | OS-level confinement per-platform; policy engine with prefix rules |
| **Interop** | `mcp-server`, `rmcp-client`, `codex-mcp`, `connectors`, `plugin`, `hooks`, `skills` | MCP both directions (client via rmcp, server prototype), plugin/skill systems |
| **Model access** | `model-provider`, `codex-api`, `responses-api-proxy`, `ollama`, `lmstudio` | Provider abstraction incl. local runtimes |
| **Delivery** | `tui`, `cli`, `app-server`, `chatgpt`, `sdk` | Multiple front-ends over one core |

**Takeaway 1 — Harness = protocol-first kernel + pluggable everything.**
The kernel speaks a typed Submission/Event protocol; TUI/CLI/app-server/SDK
are all thin consumers. This is exactly the shape OxygenClaw's `server`
(SPEC-driven REST+SSE) already has — but Codex additionally generates the TS
types from Rust, eliminating contract drift.

## 2. Approval model (directly maps to our ComputerUse permission tiers)

`protocol/src/approvals.rs` + `ReviewDecision`:
- `Approved` / `ApprovedForSession` / `ApprovedMcpPolicyAmendment` /
  `ApprovedExecpolicyAmendment` — approval **with optional policy
  amendment** ("allow always / for session" is a first-class decision).
- `NetworkApprovalContext {host, protocol}` — network egress is individually
  approvable (HTTP/HTTPS/SOCKS).
- `PermissionProfile` / `AdditionalPermissionProfile` — per-turn capability
  sets merged across escalations.

**Takeaway 2 — our three-tier ComputerUse permission (always-ask /
confirm-risky / allow-all) is the coarse UI projection of the same
concept.** To reach parity we need: per-action approval events surfaced to
the WebUI, "approve for session" persistence, and (stretch) per-host network
rules.

## 3. Session/turn lifecycle

`core/src/codex_thread.rs`: a thread = durable session with
- `Session` + `SessionIo` streams, submission/event channels,
- per-turn settings (`StepSettingsUpdate`), turn timing/diff tracking,
- rollout persistence (`rollout`, `thread-store`, `history`) — **full
  replay**, plus `compact*` crates for context compaction strategies,
- telemetry (`otel`) wired at session scope.

**Takeaway 3 — "conversation" and "runtime task" in OxygenClaw map to
Codex's thread+turn.** Our runtime_events already replay afterSeq;
adopting a compacted-rollout file per task would give us offline replay and
smaller context windows for long tasks.

## 4. MCP duality

`rmcp-client` consumes external MCP servers; `mcp-server` **exposes Codex
itself as an MCP server** (stdio prototype). OxygenClaw already has both
directions planned (`core/mcp/client.ts` + server route); Codex confirms the
"agent as MCP server" pattern is the interop seam for **harness-to-harness
communication** — i.e. OpenOxygen Next and OxygenClaw agents can
discover/steer each other over MCP.

**Takeaway 4 — the "choose-your-harness" decision should standardize on MCP
as the cross-harness bus**, with each harness exposing capabilities
(tools/resources/prompts) and a thin session protocol.

## 5. Skills & hooks

`skills` crate + `docs/skills.md` (agent-skills `SKILL.md` standard — the
same format our Marketplace zip importer already parses); `hooks` crate for
lifecycle hooks. Execpolicy uses declarative prefix rules
(`prefix_rule(..., decision="allow")`).

**Takeaway 5 — our SKILL.md zip import was the right bet**; it is the
cross-harness skill format. Next step: skill *activation* should pass a
permission profile (Codex attaches sandbox+approval context to skill runs).

## 6. What to steal, concretely (prioritized)

1. **ts_rs-style contract generation** (or OpenAPI/zod equivalent) — kill
   hand-synced types between server and webui.
2. **Approval event flow**: runtime emits `approval-request` events; WebUI
   renders approve/deny/always; decision persisted per session — completes
   our ComputerUse permission tiers.
3. **Rollout files per task** (JSONL of events) — we already have
   runtime_events; add compacted snapshots for replay.
4. **Network egress approvals** — pairs with our proxy route (which already
   has SSRF guards); add per-host allow/deny memory.
5. **Windows sandbox service** (`windows-sandbox-rs`/`-service`) — study for
   OpenOxygen Next's GUI execution isolation.

## 7. 中文摘要

- Codex 是「协议优先内核 + 一切可插拔」：类型化 Submission/Event 协议为唯一
  真相源，TUI/CLI/app-server/SDK 都是薄壳，TS 类型由 Rust 生成防漂移。
- 审批模型：批准可携带「策略修正」（本次/本会话/永久），网络出口可按 host
  单独审批——我们的 ComputerUse 三级权限是它的粗粒度投影，补齐需把审批做
  成事件流 + 会话内持久化。
- 会话=thread+turn，rollout 文件全量可回放 + 上下文压缩策略；OxygenClaw 的
  runtime_events 已有增量回放，补一份压缩快照即可对齐。
- MCP 双向（client+server）是跨 Harness 互操作总线——「用户可选 Harness」
  应以 MCP 为标准互联层。
- SKILL.md（agent-skills 标准）是跨 Harness 技能格式，我们的 zip 导入已兼容。
- 具体可借鉴（按优先级）：契约类型自动生成、审批事件流、任务级 rollout
  快照、网络出口审批、Windows 沙箱服务（供 OpenOxygen Next GUI 隔离研究）。
