# OxygenClaw WebUI Rewrite Brief For Claude

You are rewriting the OxygenClaw WebUI. Treat the current frontend as a visual/reference prototype, not as the architectural source of truth.

## Product Positioning

OxygenClaw is a broad Claw-style agent platform. The frontend should feel like a polished agent workbench for:

- Persistent chat conversations
- Long-running task execution
- ComputerUse / GUI automation execution
- Runtime event inspection and replay
- Model/provider management
- MCP agent/task management
- Marketplace/CLI skill management
- Settings and system status

The backend is being rebuilt around persistent runtime tasks and event streams. New frontend architecture should use these backend contracts directly instead of recreating local-only state.

## Important Direction Change

Do not overfit to the current `PlaygroundsV2.tsx` implementation.

The old UI had good visual ideas but weak data flow:

- Too much `localStorage` state
- Chat/task/computeruse paths mixed together
- Runtime events were not first-class
- Direct browser LLM calls existed as fallback behavior
- Task state was not recoverable after refresh

The new UI should make backend state the source of truth.

## Recommended Architecture

Use a frontend architecture with explicit domains:

- `api/` for backend clients
- `features/conversations/`
- `features/runtime/`
- `features/models/`
- `features/mcp/`
- `features/settings/`
- `features/marketplace/`
- `components/` for shared UI primitives

Suggested runtime state model:

- Conversations are chat timeline containers.
- Runtime tasks are execution records.
- Runtime events are the live/replayable execution stream.
- Worker runs are backend execution lifecycle records.

Avoid storing canonical conversations or task state only in browser storage. Local storage can be used for view preferences, draft input, theme, sidebar state, and last selected IDs.

## Backend Base URL

Development:

```text
http://localhost:3001/api
```

If using Vite proxy, frontend may call `/api`.

Auth token, if present:

```http
Authorization: Bearer <token>
```

Most JSON responses follow:

```json
{
  "success": true,
  "data": {}
}
```

Errors:

```json
{
  "success": false,
  "error": "message"
}
```

## Version

Current product display version:

```text
v26.0 Alpha 1
```

Package semver:

```text
26.0.0-alpha.1
```

Health endpoint:

```http
GET /api/health
```

Returns:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2026-07-04T00:00:00.000Z",
    "version": "26.0.0-alpha.1",
    "displayVersion": "v26.0 Alpha 1"
  }
}
```

## Models

### List enabled models

```http
GET /api/llm/models
```

Use `data.models[].id` as the canonical model ID for chat/task requests.

Example model ID:

```text
providerId:modelName
```

## Conversations

Conversations should be the source of truth for visible chat/task timelines.

### List conversations

```http
GET /api/conversations?mode=chat
```

Modes:

- `chat`
- `task`
- `computeruse`

### Create conversation

```http
POST /api/conversations
```

Request:

```json
{
  "title": "New conversation",
  "modelId": "providerId:modelName",
  "mode": "chat",
  "capability": "fast"
}
```

### Get conversation detail

```http
GET /api/conversations/:id
```

Returns `conversation` and ordered `messages`.

### Chat message generation

```http
POST /api/conversations/:id/messages
```

Request:

```json
{
  "content": "hello",
  "modelId": "providerId:modelName"
}
```

SSE format is OpenAI-compatible:

```text
data: {"choices":[{"delta":{"content":"Hello"}}]}

data: [DONE]
```

After `[DONE]`, reload `GET /api/conversations/:id` to sync real backend message IDs.

### Save message without generation

Use this for task/computeruse results.

```http
POST /api/conversations/:id/messages
```

Request:

```json
{
  "role": "assistant",
  "content": "result text",
  "generate": false
}
```

### Other conversation routes

- `PUT /api/conversations/:id`
- `DELETE /api/conversations/:id`
- `POST /api/conversations/:id/regenerate` SSE
- `POST /api/conversations/:id/messages/:messageId/edit` SSE
- `POST /api/conversations/:id/messages/:messageId/feedback`
- `GET /api/conversations/suggestions/prompts?mode=chat`

## Runtime Tasks

Runtime tasks are the source of truth for long-running execution state.

### Runtime task shape

```json
{
  "id": "uuid",
  "userId": null,
  "conversationId": null,
  "kind": "agent",
  "prompt": "task prompt",
  "task": "task prompt",
  "mode": "task",
  "capability": "fast",
  "modelId": "providerId:modelName",
  "status": "running",
  "result": "optional result",
  "error": "optional error",
  "createdAt": 1783140000000,
  "startedAt": 1783140000000,
  "updatedAt": 1783140000000,
  "completedAt": null,
  "cancelledAt": null,
  "metadata": {},
  "events": [],
  "workerRuns": [],
  "steps": []
}
```

Statuses:

- `pending`
- `running`
- `completed`
- `failed`
- `cancelled`

`pending` means the runtime worker manager has accepted the task into its queue but has not started it yet.

Kinds:

- `agent`
- `computeruse`

## Agent Task Execution

```http
POST /api/agent/execute
```

Request:

```json
{
  "prompt": "do something",
  "mode": "task",
  "capability": "fast",
  "modelId": "providerId:modelName"
}
```

SSE examples:

```text
data: {"type":"task_start","taskId":"uuid","status":"running"}

data: {"type":"step","step":{"type":"think","content":"...","timestamp":1783140000000}}

data: {"type":"task_complete","taskId":"uuid","status":"completed","result":"...","steps":[]}
```

Important: even failures are persisted as runtime events.

### Preferred long-running task start

```http
POST /api/agent/start
```

Request body is the same as `/api/agent/execute`, but the response is JSON immediately:

```json
{
  "success": true,
  "data": {
    "taskId": "uuid",
    "workerRunId": "uuid",
    "status": "pending",
    "eventsUrl": "/api/agent/tasks/uuid/events/live"
  }
}
```

## ComputerUse Execution

```http
POST /api/agent/computeruse/execute
```

Request:

```json
{
  "task": "open app and inspect screen",
  "modelId": "providerId:modelName"
}
```

The SSE format is the same as task execution. GUI-related steps may contain `step.action`.

Preferred long-running start endpoint:

```http
POST /api/agent/computeruse/start
```

## Runtime Query And Replay

### List runtime tasks

```http
GET /api/agent/tasks
```

### Get one runtime task

```http
GET /api/agent/tasks/:id
```

Returns task with:

- `events`
- `workerRuns`
- derived `steps`

### Get events

```http
GET /api/agent/tasks/:id/events
```

Incremental fetch:

```http
GET /api/agent/tasks/:id/events?afterSeq=3
```

### Replay events as SSE

```http
GET /api/agent/tasks/:id/events/stream?afterSeq=3
```

Example:

```text
data: {"type":"step","seq":4,"step":{"type":"output","content":"..."}}

data: [DONE]
```

### Subscribe to live events

```http
GET /api/agent/tasks/:id/events/live?afterSeq=3
```

This replays events after `afterSeq`, then stays connected until a terminal event arrives.

### Worker runs

```http
GET /api/agent/tasks/:id/workers
```

Use this for technical task diagnostics.

### Worker manager state

```http
GET /api/agent/runtime/workers
```

Use this for runtime diagnostics and dashboard health. It returns max concurrency, queued count, running count, registered worker adapters, queued task IDs, and running task heartbeats.

### Worker capabilities

```http
GET /api/agent/runtime/workers/capabilities
```

Use this to decide which execution backends are selectable. The default frontend choice should remain `local-agent` unless another worker reports `available: true`.

`POST /api/agent/start` accepts optional `workerType`. Current values are `local-agent` and `container-agent`. `container-agent` is registered as a safe scaffold and may report unavailable until Docker and sandbox image wiring are complete.

### Cancel task

```http
POST /api/agent/tasks/:id/cancel
```

### Delete task

```http
DELETE /api/agent/tasks/:id
```

## Recommended UI Flows

### Chat flow

1. Ensure model selected.
2. Create or load conversation.
3. Send `/api/conversations/:id/messages`.
4. Render OpenAI-compatible chunks.
5. On `[DONE]`, reload conversation detail.

### Task flow

1. Create or load a `mode=task` conversation.
2. Save user message with `generate:false`.
3. Prefer `POST /api/agent/start`.
4. Store `taskId` from the JSON response.
5. Subscribe to `/api/agent/tasks/:taskId/events/live?afterSeq=<lastSeq>`.
6. Render live SSE events.
7. Track last seen `seq` where available.
8. If disconnected, recover with `/api/agent/tasks/:taskId/events?afterSeq=<lastSeq>` or `/events/live`.
9. Save final assistant/result message with `generate:false`.

### ComputerUse flow

Same as task flow but use `/api/agent/computeruse/execute` and render `step.action` when present.

## Suggested Screens

- Dashboard: health, recent tasks, model status, failures
- Playgrounds/Workbench: conversation list + message timeline + runtime event panel
- Task Detail: event timeline, steps, worker runs, raw JSON toggle
- Models: provider/model management
- MCP: registered agents and tasks
- Marketplace: skills and CLI status
- Settings: theme, defaults, multimodal, privacy/runtime settings

## Do Not Do These

- Do not store canonical conversations only in `localStorage`.
- Do not treat SSE as non-recoverable; use runtime event replay.
- Do not bypass backend for normal model calls.
- Do not couple task UI directly to old `agent_tasks` rows.
- Do not assume task failure means no useful data; failed tasks still have events.
- Do not design ComputerUse UI as plain chat only; it needs actions, screenshots/artifacts later, and worker diagnostics.

## Current Backend Limits To Design Around

- Runtime persistence exists and local execution now goes through an in-process worker manager with queueing, concurrency limits, heartbeat, and stale-task sweep.
- Workers are not separate OS processes or containers yet.
- `container-agent` exists as a non-default backend option for capability probing, but should not be presented as a normal user option unless it reports `available: true`.
- On server restart, orphan `pending`/`running` tasks are marked failed rather than left stuck forever.
- Container workers are not implemented yet.
- True PTY terminal sessions are not implemented yet.
- ComputerUse operator/runtime needs another backend phase.
- Attachments/artifacts are not fully first-class yet.

Design the new frontend so these can be added without rewriting the UI again.
