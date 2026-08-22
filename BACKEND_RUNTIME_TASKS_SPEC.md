# OxygenClaw Runtime Tasks API 规范 — 前后端协调文档

**受众**: GPT（后端开发者） + Claude（前端开发者）  
**目的**: 定义任务执行、事件流、可视化的完整契约。

---

## 1. 系统概述

OxygenClaw 的 Runtime 任务系统用于执行长时间运行的 AI 任务（代码生成、文件操作、工具调用链）。

**核心能力**:
- 任务创建、查询、取消
- 实时事件流（SSE）推送任务进度
- 任务事件时间线可视化
- 子任务树结构展示

**参考文档**: `CLAUDE_FRONTEND_BRIEF.md` 中的 `runtime_tasks` 和 `runtime_events` 设计。

---

## 2. 数据模型

### 2.1 RuntimeTask（运行时任务）

```typescript
interface RuntimeTask {
  id: string;                          // UUID
  conversationId?: string;             // 关联会话 ID（可选）
  type: 'code_generation' | 'file_operation' | 'tool_chain' | 'research' | 'custom';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  title: string;                       // 任务标题
  description?: string;                // 任务描述
  createdAt: string;                   // ISO 8601
  startedAt?: string;                  // 开始执行时间
  completedAt?: string;                // 完成时间
  progress: number;                    // 进度百分比 (0-100)
  result?: unknown;                    // 任务结果（JSON）
  error?: {                            // 错误信息
    code: string;
    message: string;
    stack?: string;
  };
  metadata?: {
    model?: string;                    // 使用的模型
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
    parentTaskId?: string;             // 父任务 ID（子任务）
    priority?: 'low' | 'normal' | 'high';
  };
}
```

### 2.2 RuntimeEvent（运行时事件）

```typescript
interface RuntimeEvent {
  id: string;                          // UUID
  taskId: string;                      // 所属任务 ID
  type: 'log' | 'tool_call' | 'file_change' | 'subtask_start' | 'subtask_end' | 'progress' | 'error';
  timestamp: string;                   // ISO 8601
  data: unknown;                       // 事件数据（根据 type 不同）
}

// 事件数据类型示例
type EventData =
  | { type: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | { type: 'tool_call'; toolName: string; arguments: Record<string, unknown>; result?: unknown }
  | { type: 'file_change'; path: string; operation: 'create' | 'update' | 'delete'; content?: string }
  | { type: 'subtask_start'; subtaskId: string; title: string }
  | { type: 'subtask_end'; subtaskId: string; status: 'completed' | 'failed' }
  | { type: 'progress'; percentage: number; message?: string }
  | { type: 'error'; code: string; message: string };
```

---

## 3. API 端点

### 3.1 `GET /runtime/tasks`

**功能**: 获取任务列表（分页、筛选）。

**Query 参数**:
```typescript
{
  page?: number;
  pageSize?: number;
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  type?: 'code_generation' | 'file_operation' | 'tool_chain' | 'research' | 'custom';
  conversationId?: string;  // 筛选特定会话的任务
  sortBy?: 'createdAt' | 'startedAt' | 'completedAt';
  order?: 'asc' | 'desc';
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "task-123",
        "type": "code_generation",
        "status": "completed",
        "title": "生成 React 组件",
        "createdAt": "2026-07-04T14:00:00Z",
        "startedAt": "2026-07-04T14:00:01Z",
        "completedAt": "2026-07-04T14:02:30Z",
        "progress": 100,
        "result": { "files": [{ "path": "Button.tsx", "lines": 135 }] },
        "metadata": { "model": "gpt-4", "tokens": { "total": 2500 } }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

### 3.2 `POST /runtime/tasks`

**功能**: 创建新任务。

**请求体**:
```json
{
  "type": "code_generation",
  "title": "生成用户认证模块",
  "description": "实现 JWT 认证 + 密码加密",
  "conversationId": "conv-456",
  "metadata": {
    "model": "gpt-4",
    "priority": "high"
  },
  "params": {
    "language": "typescript",
    "framework": "express"
  }
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "id": "task-789",
    "type": "code_generation",
    "status": "pending",
    "title": "生成用户认证模块",
    "createdAt": "2026-07-04T14:10:00Z",
    "progress": 0
  }
}
```

---

### 3.3 `GET /runtime/tasks/:id`

**功能**: 获取单个任务详情。

**响应格式**:
```json
{
  "success": true,
  "data": {
    "task": { /* RuntimeTask 对象 */ },
    "subtasks": [
      { "id": "subtask-001", "title": "分析需求", "status": "completed" },
      { "id": "subtask-002", "title": "生成代码", "status": "running" }
    ],
    "recentEvents": [
      { "id": "evt-001", "type": "log", "timestamp": "...", "data": { "level": "info", "message": "开始生成代码" } }
    ]
  }
}
```

---

### 3.4 `GET /runtime/tasks/:id/events`

**功能**: 获取任务事件流（SSE 实时推送）。

**Query 参数**:
```typescript
{
  since?: string;  // ISO 8601 时间戳，只返回此时间之后的事件
}
```

**响应格式**（SSE 流）:
```
Content-Type: text/event-stream

event: task.start
data: {"taskId":"task-789","status":"running","startedAt":"2026-07-04T14:10:01Z"}

event: progress
data: {"taskId":"task-789","progress":25,"message":"正在分析需求"}

event: log
data: {"taskId":"task-789","level":"info","message":"需求分析完成，开始生成代码"}

event: tool_call
data: {"taskId":"task-789","toolName":"writeFile","arguments":{"path":"auth.ts","content":"..."},"result":{"success":true}}

event: subtask.start
data: {"taskId":"task-789","subtaskId":"subtask-003","title":"运行测试"}

event: subtask.end
data: {"taskId":"task-789","subtaskId":"subtask-003","status":"completed"}

event: progress
data: {"taskId":"task-789","progress":100,"message":"任务完成"}

event: task.done
data: {"taskId":"task-789","status":"completed","completedAt":"2026-07-04T14:12:30Z","result":{"files":[...]}}

event: error
data: {"taskId":"task-789","code":"EXECUTION_ERROR","message":"文件写入失败"}
```

**SSE 事件类型**:
- `task.start` — 任务开始执行
- `task.done` — 任务完成
- `progress` — 进度更新
- `log` — 日志事件
- `tool_call` — 工具调用
- `file_change` — 文件变更
- `subtask.start` / `subtask.end` — 子任务状态
- `error` — 错误事件

---

### 3.5 `POST /runtime/tasks/:id/cancel`

**功能**: 取消运行中的任务。

**请求体**: 无

**响应格式**:
```json
{
  "success": true,
  "data": {
    "id": "task-789",
    "status": "cancelled",
    "completedAt": "2026-07-04T14:11:00Z"
  }
}
```

---

### 3.6 `GET /runtime/tasks/:id/events/history`

**功能**: 获取任务历史事件（分页，非SSE）。

**Query 参数**:
```typescript
{
  page?: number;
  pageSize?: number;
  type?: 'log' | 'tool_call' | 'file_change' | 'subtask_start' | 'subtask_end' | 'progress' | 'error';
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "events": [ /* RuntimeEvent 数组 */ ],
    "pagination": { "page": 1, "pageSize": 50, "total": 127 }
  }
}
```

---

## 4. 前端集成方案

### 4.1 React Query Hooks

```typescript
// useRuntimeTasks.ts
export function useRuntimeTasks(params?: TaskQueryParams) {
  return useQuery({
    queryKey: ['runtime-tasks', params],
    queryFn: () => runtimeApi.listTasks(params),
    refetchInterval: 5000, // 轮询刷新运行中任务
  });
}

// useRuntimeTask.ts
export function useRuntimeTask(id: string) {
  return useQuery({
    queryKey: ['runtime-task', id],
    queryFn: () => runtimeApi.getTask(id),
  });
}

// useTaskEvents.ts（SSE 流）
export function useTaskEvents(taskId: string, onEvent: (event: RuntimeEvent) => void) {
  useEffect(() => {
    const eventSource = new EventSource(`/api/runtime/tasks/${taskId}/events`);
    
    eventSource.addEventListener('progress', (e) => {
      onEvent({ type: 'progress', ...JSON.parse(e.data) });
    });
    
    eventSource.addEventListener('log', (e) => {
      onEvent({ type: 'log', ...JSON.parse(e.data) });
    });
    
    // ... 其他事件类型
    
    return () => eventSource.close();
  }, [taskId]);
}
```

### 4.2 任务详情页面组件

```tsx
// pages/TaskDetail.tsx
export function TaskDetail({ taskId }: { taskId: string }) {
  const { data: task } = useRuntimeTask(taskId);
  const [events, setEvents] = useState<RuntimeEvent[]>([]);

  useTaskEvents(taskId, (event) => {
    setEvents((prev) => [...prev, event]);
  });

  return (
    <div>
      <h1>{task?.title}</h1>
      <ProgressBar value={task?.progress || 0} />
      
      {/* 事件时间线 */}
      <Timeline>
        {events.map((evt) => (
          <TimelineItem key={evt.id} event={evt} />
        ))}
      </Timeline>
      
      {/* 子任务树 */}
      <SubtaskTree subtasks={task?.subtasks} />
    </div>
  );
}
```

---

## 5. 后端实现要点

### 5.1 数据库 Schema

```sql
CREATE TABLE runtime_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  conversation_id UUID,
  type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  progress INT DEFAULT 0,
  result JSONB,
  error JSONB,
  metadata JSONB,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE TABLE runtime_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  data JSONB NOT NULL,
  CONSTRAINT fk_task FOREIGN KEY (task_id) REFERENCES runtime_tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_tasks_user_status ON runtime_tasks(user_id, status, created_at DESC);
CREATE INDEX idx_events_task_timestamp ON runtime_events(task_id, timestamp DESC);
```

### 5.2 SSE 实现（Node.js 示例）

```typescript
app.get('/runtime/tasks/:id/events', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { id: taskId } = req.params;
  const { since } = req.query;

  // 订阅任务事件（使用 Redis Pub/Sub 或 EventEmitter）
  const subscription = eventBus.subscribe(`task:${taskId}`, (event: RuntimeEvent) => {
    if (since && new Date(event.timestamp) <= new Date(since as string)) return;
    
    res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
  });

  req.on('close', () => {
    subscription.unsubscribe();
  });
});
```

### 5.3 任务执行引擎

```typescript
class TaskExecutor {
  async execute(task: RuntimeTask) {
    await this.updateTask(task.id, { status: 'running', startedAt: new Date() });
    this.emitEvent(task.id, { type: 'task.start', data: { taskId: task.id } });

    try {
      // 执行任务逻辑
      for (const step of task.steps) {
        this.emitEvent(task.id, { type: 'log', data: { level: 'info', message: `执行步骤: ${step.name}` } });
        
        const result = await step.execute();
        
        this.emitEvent(task.id, { type: 'progress', data: { progress: step.progress } });
        
        if (step.toolCall) {
          this.emitEvent(task.id, { type: 'tool_call', data: step.toolCall });
        }
      }

      await this.updateTask(task.id, { 
        status: 'completed', 
        completedAt: new Date(), 
        progress: 100,
        result: task.result 
      });
      
      this.emitEvent(task.id, { type: 'task.done', data: { taskId: task.id, result: task.result } });
    } catch (error) {
      await this.updateTask(task.id, { 
        status: 'failed', 
        completedAt: new Date(),
        error: { code: 'EXECUTION_ERROR', message: error.message } 
      });
      
      this.emitEvent(task.id, { type: 'error', data: { code: 'EXECUTION_ERROR', message: error.message } });
    }
  }

  private emitEvent(taskId: string, event: RuntimeEvent) {
    eventBus.publish(`task:${taskId}`, event);
    db.insert('runtime_events', { task_id: taskId, ...event });
  }
}
```

---

## 6. UI 组件设计

### 6.1 任务列表页（/tasks）

```
┌─────────────────────────────────────────────────────┐
│ 🏃 运行时任务                              [新建任务] │
├─────────────────────────────────────────────────────┤
│ 🔵 运行中 (3) │ ✅ 已完成 (45) │ ❌ 失败 (2)        │
├─────────────────────────────────────────────────────┤
│ 📝 生成用户认证模块             ████████░░ 80%       │
│    GPT-4 · 2分钟前 · code_generation                │
├─────────────────────────────────────────────────────┤
│ 🔍 研究 React 19 新特性         ██████████ 100%      │
│    Claude 3 · 10分钟前 · research                    │
└─────────────────────────────────────────────────────┘
```

### 6.2 任务详情页（/tasks/:id）

```
┌─────────────────────────────────────────────────────┐
│ ← 返回     生成用户认证模块                [取消任务] │
├─────────────────────────────────────────────────────┤
│ 状态: 运行中 | 进度: 75% | 用时: 2m 30s             │
│ ████████████████████████░░░░░                       │
├─────────────────────────────────────────────────────┤
│ 事件时间线:                                          │
│                                                     │
│ 14:10:01  ✅ 任务开始                               │
│ 14:10:05  📝 需求分析完成                           │
│ 14:11:20  🔧 调用工具: writeFile(auth.ts)          │
│ 14:11:45  📊 进度更新: 75%                          │
│ 14:12:10  🔄 正在运行测试...                        │
└─────────────────────────────────────────────────────┘
```

---

## 7. 测试清单

- [ ] `GET /runtime/tasks` 返回任务列表
- [ ] `POST /runtime/tasks` 创建任务成功
- [ ] `GET /runtime/tasks/:id` 返回任务详情+子任务
- [ ] `GET /runtime/tasks/:id/events` SSE 流正确推送事件
- [ ] `POST /runtime/tasks/:id/cancel` 取消任务成功
- [ ] 任务执行中实时推送进度事件
- [ ] 工具调用事件包含完整参数和结果
- [ ] 错误情况下推送 `error` 事件
- [ ] 子任务状态变更正确推送
- [ ] 前端 EventSource 断线重连正常

---

**协调完成标志**: 前端打开任务详情页，实时看到事件时间线滚动更新。
