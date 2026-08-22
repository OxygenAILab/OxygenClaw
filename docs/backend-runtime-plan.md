# OxygenClaw Backend Runtime Plan

## Decision

Keep the current WebUI and public HTTP API shape, but rebuild the backend runtime underneath it.

This is not a full product rewrite. The WebUI has usable structure and a mostly understandable API client. The current backend routes should become a compatibility layer while the real agent runtime, session management, container execution, privacy routing, and GUI automation layers are rebuilt with clearer boundaries.

## Why Not Patch Only

The current backend has route handlers, database tables, and agent classes, but the core execution model is not reliable enough to support a Claw-style product.

- The build graph is broken because server imports core source files directly through path aliases while server `rootDir` is `src`.
- Playgrounds, MCP, Dashboard, Settings, Marketplace, and CLI have multiple frontend/backend contract mismatches.
- The current agent loop is mostly an LLM wrapper with simulated MoA behavior and weak tool execution.
- The terminal layer is not a PTY-backed session runtime. It is a one-shot `child_process.exec` wrapper around `openclawmp`.
- Container support exists as a thin Docker helper, not as a session-isolated agent runtime.
- ComputerUse has a useful skeleton, but lacks UI-TARS-grade operator abstraction, event streaming, retry semantics, pause/stop state, and robust action parsing.
- Edge/cloud privacy routing is declared in types, but not enforced across model, tool, memory, and message write checkpoints.

Patching individual endpoints would make the UI look better without fixing the backend's execution model.

## Reference Architecture

### NanoClaw Lessons

Use a single host process with persistent SQLite-backed queues and per-session execution isolation.

- Host owns routing, auth, WebUI API, task/session records, delivery, and recovery sweeps.
- Agent execution happens in isolated session workers, preferably containers when available.
- Session state is a first-class concept, not an incidental task row.
- Queue state is persisted and recoverable, not only held in memory maps.
- Host and worker communicate through durable messages/events rather than ad hoc callbacks.

### EdgeClaw Lessons

Put privacy and model routing in a central checkpoint pipeline before model calls and tool calls.

- Classify every user message, tool call, tool result, memory write, and outbound response as S1/S2/S3.
- Let safety routing override cost routing.
- Keep full local memory separate from redacted cloud memory.
- Route S3 to local/guard model only; route S2 through redaction or local fallback; allow S1 to use cloud providers.
- Make routing decisions auditable and stored with the session event stream.

### UI-TARS-Desktop Lessons

Rebuild ComputerUse around operator contracts and observable loop events.

- Separate screenshot acquisition, action parsing, coordinate conversion, action execution, and event streaming.
- Use a strong action parser that understands UI-TARS formats and model versions.
- Emit every loop state: screenshot, model request, model response, parsed action, action result, error, pause, resume, stop, max-loop termination.
- Prefer real operator implementations over mock fallback for claimed supported platforms.

### StepClaw Product Lessons

Treat StepClaw as product-shape guidance, not source-code guidance.

- WebUI should feel simple and stable.
- Setup should hide unnecessary model/container complexity.
- Long-running tasks, triggers, skills, and remote command channels need persistent backend state.
- The backend must support cloud/local dual mode without requiring users to manually reason about routing every time.

## Target Backend Shape

### Packages

- `@oxygen-claw/server`: HTTP/SSE/WebSocket compatibility layer and WebUI API surface.
- `@oxygen-claw/runtime`: host runtime, task/session queue, worker lifecycle, event bus, cancellation, recovery.
- `@oxygen-claw/core`: model provider contracts, tool contracts, agent loop primitives, shared runtime types.
- `@oxygen-claw/computeruse`: GUI action parser, operators, ComputerUse loop.
- `@oxygen-claw/security`: privacy classifier, redactor, model routing policy, audit records.
- `@oxygen-claw/shared`: shared API DTOs and frontend-safe types.

The current `packages/core` can be split gradually. The immediate goal is to stop server from compiling against `../core/src` and force package boundaries through built outputs or project references.

### Runtime Model

1. WebUI calls existing `/api/*` routes.
2. Route handler validates request and creates a `session`, `task`, or `conversation` command.
3. Runtime writes command to durable queue and emits SSE-compatible events.
4. Worker executes task through agent loop.
5. Every loop emits typed events into `runtime_events`.
6. WebUI receives compatibility SSE events derived from runtime events.
7. Final output persists to conversations, tasks, usage stats, and audit tables.

### Session Model

- `sessions`: persistent execution scope.
- `tasks`: user-visible task records.
- `messages`: conversation messages.
- `runtime_events`: append-only event stream.
- `worker_runs`: worker lifecycle, retries, exit reason.
- `artifacts`: screenshots, logs, generated files, terminal transcripts.
- `privacy_decisions`: S1/S2/S3 decisions, redaction summary, model route.

### Worker Model

- Local in-process worker for development and low-risk chat.
- Container worker for agent/tool execution and code/terminal tasks.
- GUI worker for ComputerUse on supported desktop platforms.
- Future remote worker for edge devices or StepClaw-like cloud/local hybrid.

Workers must support start, cancel, heartbeat, timeout, event streaming, and recovery.

Current implementation now separates HTTP routes from runtime workers through adapter boundaries:

- `packages/server/src/routes/agent.ts` owns request validation, compatibility routes, and runtime job creation only.
- `packages/server/src/services/runtimeWorkerManager.ts` owns queueing, concurrency, heartbeat, cancellation, and stale-task recovery.
- `packages/server/src/runtime/adapters/localAgent.ts` owns local agent execution.
- `packages/server/src/runtime/adapters/localComputerUse.ts` owns local ComputerUse execution.
- `packages/server/src/runtime/adapters/containerAgent.ts` is the non-default container worker scaffold and capability probe.
- `packages/server/src/runtime/adapters/index.ts` is the registration boundary for current and future worker adapters.

Future container, PTY terminal, GUI, and remote workers should be added as new adapters rather than expanding route handlers.

The current `container-agent` adapter is intentionally safe: it exposes capability status and Docker availability, but does not run untrusted workload until the sandbox image, workspace mounts, artifact capture, and command policy are wired.

### Terminal Model

The current `/api/cli` remains as a Marketplace/openclawmp manager only. A real Claw terminal requires a separate runtime surface.

- PTY-backed shell session.
- WebSocket or SSE transcript stream.
- stdin, stdout, stderr, resize, exit code, cwd, env.
- command approval policy.
- per-session persistence.
- container-first execution for unsafe commands.

Do not market the current CLI route as the Claw terminal.

### Privacy Routing

Add a mandatory policy pipeline before model/tool/memory operations.

1. `before_message_accept`
2. `before_model_route`
3. `before_prompt_build`
4. `before_tool_call`
5. `after_tool_result`
6. `before_memory_write`
7. `before_response_emit`

The first implementation can use rule-based detection with optional local model classification later.

### API Compatibility

Keep these existing surfaces stable first:

- `/api/auth/*`
- `/api/llm/*`
- `/api/settings`
- `/api/conversations/*`
- `/api/agent/execute`
- `/api/agent/computeruse/execute`
- `/api/agent/tasks/*`
- `/api/mcp/*`
- `/api/marketplace/*`
- `/api/cli/*`
- `/api/proxy/request`
- `/api/dashboard/stats`

Fix response shape mismatches in the compatibility layer rather than forcing the WebUI to churn immediately.

## First Implementation Phase

### Phase 1: Stabilize Build And Contracts

- Add missing `packages/shared/tsconfig.json`.
- Fix `packages/webui` build entry issue by ensuring Vite runs with the package root and has `index.html` where expected.
- Replace server `@oxygen-claw/core` source alias with a package boundary that does not violate `rootDir`.
- Add `sql.js` declaration or type dependency.
- Fix auth login to accept `emailOrUsername`.
- Fix auth `me` response compatibility.
- Fix marketplace detail alias.
- Fix conversation clear route compatibility.
- Fix CLI install streaming mismatch or change frontend API to JSON.
- Fix `agent/tasks` and `conversations` response shapes.

### Phase 2: Make Conversations Real

- Move PlaygroundsV2 conversation list/create/delete/rename/search to `/api/conversations`.
- Send chat messages through `/api/conversations/:id/messages`.
- Persist regenerated and edited messages.
- Store task and ComputerUse outputs as conversation messages.
- Keep localStorage only as offline cache.

### Phase 3: Runtime Kernel

- Add runtime event schema and queue tables.
- Replace in-memory `activeAgents` maps with persistent task/session state.
- Implement local worker loop with typed events.
- Adapt `/api/agent/execute` SSE to stream runtime events.
- Add cancellation through persistent runtime state.

### Phase 4: Container Runtime

- Introduce session workspaces.
- Add Docker worker lifecycle.
- Store logs, artifacts, and exit reasons.
- Add heartbeat and recovery sweep.
- Move unsafe tools and future terminal sessions into containers.

### Phase 5: ComputerUse Runtime

- Replace current parser with UI-TARS-style parser support.
- Replace PowerShell-only operator assumptions with operator interface and platform capability detection.
- Add screenshot validation, retry, loop state, pause/resume/stop, max-loop termination.
- Stream screenshot/action/result events to WebUI.

### Phase 6: Edge/Cloud Privacy Router

- Add S1/S2/S3 classifier.
- Add redaction and local-only guard route.
- Add privacy decision records.
- Split full local memory and cloud-safe memory.
- Route model calls through policy rather than direct provider selection.

## Immediate Recommendation

Start with Phase 1 and Phase 2 before touching the deeper runtime. They unblock build, make WebUI behavior honest, and establish the compatibility layer that the runtime rebuild will plug into.

After that, build the runtime kernel behind `/api/agent/execute` while keeping the frontend contract stable. This lets OxygenClaw improve from the inside without throwing away the existing UI.
