# OxygenClaw Conversations API 规范 — 前后端协调文档

**受众**: GPT（后端开发者） + Claude（前端开发者）  
**目的**: 定义会话持久化与消息流的完整契约，确保前后端数据一致、实时同步。

---

## 1. 系统概述

当前问题：
- **前端** `store/index.ts` 把会话存 `localStorage`，刷新后任务丢失
- **后端** 无会话持久化，无法跨设备/跨会话恢复对话

新设计：
- **后端** 提供 RESTful CRUD API + SSE 消息流
- **前端** 使用 React Query 管理会话状态，SSE 接收实时消息
- **存储** 后端数据库（SQLite/PostgreSQL），支持全文搜索

---

## 2. 数据模型

### 2.1 Conversation（会话）

```typescript
interface Conversation {
  id: string;                          // UUID
  title: string;                       // 会话标题（自动生成或用户修改）
  mode: 'chat' | 'task' | 'computeruse'; // 交互模式
  capability: 'fast' | 'think' | 'expert' | 'research' | 'moa'; // 能力模式
  modelId: string;                     // 使用的模型 ID
  createdAt: string;                   // ISO 8601 时间戳
  updatedAt: string;                   // 最后更新时间
  messageCount: number;                // 消息数量
  metadata?: {                         // 元数据（可选）
    tags?: string[];                   // 标签
    pinned?: boolean;                  // 置顶
    archived?: boolean;                // 归档
    color?: string;                    // 颜色标记
  };
}
```

### 2.2 Message（消息）

```typescript
interface Message {
  id: string;                          // UUID
  conversationId: string;              // 所属会话 ID
  role: 'user' | 'assistant' | 'system'; // 角色
  content: string;                     // 消息内容（markdown）
  createdAt: string;                   // 时间戳
  metadata?: {
    model?: string;                    // 使用的模型（assistant 专用）
    tokens?: {                         // Token 统计
      prompt: number;
      completion: number;
      total: number;
    };
    thinkingContent?: string;          // 思考过程（think 模式）
    toolCalls?: ToolCall[];            // 工具调用记录
    attachments?: Attachment[];        // 附件
    feedback?: 'like' | 'dislike';     // 用户反馈
    regenerated?: boolean;             // 是否为重新生成
  };
}

interface ToolCall {
  id: string;
  name: string;                        // 工具名称
  status: 'pending' | 'running' | 'completed' | 'failed';
  arguments: Record<string, unknown>;  // 工具参数
  result?: unknown;                    // 工具返回结果
  error?: string;                      // 错误信息
  startedAt: string;
  completedAt?: string;
}

interface Attachment {
  id: string;
  type: 'image' | 'file' | 'audio';
  name: string;
  size: number;
  url: string;                         // 存储 URL（S3/本地）
  mimeType: string;
}
```

---

## 3. API 端点

### 3.1 `GET /conversations`

**功能**: 获取会话列表（分页、搜索、筛选）。

**Query 参数**:
```typescript
{
  page?: number;           // 页码（从1开始，默认1）
  pageSize?: number;       // 每页数量（默认20，最大100）
  search?: string;         // 全文搜索（标题+消息内容）
  mode?: 'chat' | 'task' | 'computeruse'; // 模式筛选
  archived?: boolean;      // 是否归档
  tags?: string[];         // 标签筛选（逗号分隔）
  sortBy?: 'updatedAt' | 'createdAt' | 'messageCount'; // 排序字段
  order?: 'asc' | 'desc';  // 排序方向（默认 desc）
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv-123",
        "title": "讨论前端重构方案",
        "mode": "chat",
        "capability": "expert",
        "modelId": "gpt-4",
        "createdAt": "2026-07-04T10:30:00Z",
        "updatedAt": "2026-07-04T12:45:00Z",
        "messageCount": 15,
        "metadata": { "pinned": true, "tags": ["frontend", "refactor"] }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 127,
      "totalPages": 7
    }
  }
}
```

---

### 3.2 `POST /conversations`

**功能**: 创建新会话。

**请求体**:
```json
{
  "title": "新对话",
  "mode": "chat",
  "capability": "fast",
  "modelId": "gpt-4",
  "metadata": {
    "tags": ["test"]
  }
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "id": "conv-456",
    "title": "新对话",
    "mode": "chat",
    "capability": "fast",
    "modelId": "gpt-4",
    "createdAt": "2026-07-04T13:00:00Z",
    "updatedAt": "2026-07-04T13:00:00Z",
    "messageCount": 0,
    "metadata": { "tags": ["test"] }
  }
}
```

---

### 3.3 `GET /conversations/:id`

**功能**: 获取单个会话详情（含最近 N 条消息）。

**Query 参数**:
```typescript
{
  includeMessages?: boolean; // 是否包含消息（默认 true）
  messageLimit?: number;     // 消息数量限制（默认50）
  beforeMessageId?: string;  // 分页：获取此消息之前的消息
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "conversation": { /* Conversation 对象 */ },
    "messages": [
      {
        "id": "msg-789",
        "conversationId": "conv-456",
        "role": "user",
        "content": "你好",
        "createdAt": "2026-07-04T13:01:00Z"
      },
      {
        "id": "msg-790",
        "conversationId": "conv-456",
        "role": "assistant",
        "content": "你好！有什么可以帮助你的吗？",
        "createdAt": "2026-07-04T13:01:02Z",
        "metadata": {
          "model": "gpt-4",
          "tokens": { "prompt": 5, "completion": 12, "total": 17 }
        }
      }
    ],
    "hasMore": false
  }
}
```

---

### 3.4 `PUT /conversations/:id`

**功能**: 更新会话元数据（标题/标签/置顶等）。

**请求体**:
```json
{
  "title": "新标题",
  "metadata": {
    "pinned": true,
    "tags": ["important", "frontend"]
  }
}
```

**响应格式**:
```json
{
  "success": true,
  "data": { /* 更新后的 Conversation 对象 */ }
}
```

---

### 3.5 `DELETE /conversations/:id`

**功能**: 删除会话（软删除或硬删除）。

**Query 参数**:
```typescript
{
  permanent?: boolean; // 是否永久删除（默认 false，软删除）
}
```

**响应格式**:
```json
{
  "success": true,
  "message": "Conversation deleted successfully"
}
```

---

### 3.6 `POST /conversations/:id/messages`

**功能**: 发送用户消息，返回 SSE 流式响应（assistant 消息）。

**请求体**:
```json
{
  "content": "请解释一下React Hooks",
  "attachments": [
    {
      "type": "image",
      "url": "https://example.com/image.png",
      "name": "example.png",
      "size": 1024,
      "mimeType": "image/png"
    }
  ]
}
```

**响应格式**（SSE 流）:
```
Content-Type: text/event-stream

event: message.start
data: {"messageId":"msg-001","role":"assistant","createdAt":"2026-07-04T13:05:00Z"}

event: message.delta
data: {"content":"React"}

event: message.delta
data: {"content":" Hooks"}

event: tool.call
data: {"toolCallId":"tool-001","name":"searchWeb","status":"running","arguments":{"query":"React Hooks official docs"}}

event: tool.result
data: {"toolCallId":"tool-001","status":"completed","result":{"url":"https://react.dev/reference/react","title":"React Hooks API"}}

event: message.done
data: {"messageId":"msg-001","content":"React Hooks 是...","tokens":{"prompt":10,"completion":150,"total":160}}

event: error
data: {"code":"MODEL_ERROR","message":"Model API timeout"}
```

**SSE 事件类型**:
- `message.start` — 消息开始（返回 messageId）
- `message.delta` — 流式内容增量
- `message.done` — 消息完成（返回完整内容+token统计）
- `tool.call` — 工具调用开始
- `tool.result` — 工具调用完成
- `error` — 错误事件

---

### 3.7 `GET /conversations/:id/messages`

**功能**: 获取会话历史消息（分页）。

**Query 参数**:
```typescript
{
  page?: number;
  pageSize?: number;
  beforeMessageId?: string; // 游标分页
}
```

**响应格式**:
```json
{
  "success": true,
  "data": {
    "messages": [ /* Message 数组 */ ],
    "hasMore": true
  }
}
```

---

### 3.8 `POST /conversations/:id/messages/:messageId/feedback`

**功能**: 提交消息反馈（点赞/点踩）。

**请求体**:
```json
{
  "type": "like" | "dislike",
  "comment": "回答很详细"  // 可选
}
```

**响应格式**:
```json
{
  "success": true,
  "message": "Feedback recorded"
}
```

---

### 3.9 `POST /conversations/:id/messages/:messageId/regenerate`

**功能**: 重新生成 assistant 消息（返回 SSE 流）。

**请求体**: 无

**响应格式**: 同 `POST /conversations/:id/messages`（SSE 流）

---

## 4. 前端集成方案

### 4.1 React Query Hooks

```typescript
// useConversations.ts
export function useConversations(params?: ConversationQueryParams) {
  return useQuery({
    queryKey: ['conversations', params],
    queryFn: () => conversationApi.list(params),
  });
}

// useConversation.ts
export function useConversation(id: string) {
  return useQuery({
    queryKey: ['conversation', id],
    queryFn: () => conversationApi.get(id),
  });
}

// useSendMessage.ts
export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (content: string) => {
      // 返回 EventSource 处理 SSE
      return conversationApi.sendMessage(conversationId, content);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['conversation', conversationId]);
      queryClient.invalidateQueries(['conversations']);
    },
  });
}
```

### 4.2 SSE 流处理

```typescript
// conversationApi.ts
export async function sendMessage(
  conversationId: string,
  content: string,
  onDelta: (chunk: string) => void,
  onToolCall: (tool: ToolCall) => void,
  onComplete: (message: Message) => void,
  onError: (error: Error) => void
): Promise<void> {
  const response = await fetch(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = JSON.parse(line.slice(6));
      
      if (line.startsWith('event: message.delta')) {
        onDelta(data.content);
      } else if (line.startsWith('event: tool.call')) {
        onToolCall(data);
      } else if (line.startsWith('event: message.done')) {
        onComplete(data);
      } else if (line.startsWith('event: error')) {
        onError(new Error(data.message));
      }
    }
  }
}
```

---

## 5. 后端实现要点

### 5.1 数据库 Schema（PostgreSQL 示例）

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  mode VARCHAR(20) NOT NULL,
  capability VARCHAR(20) NOT NULL,
  model_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  message_count INT DEFAULT 0,
  metadata JSONB,
  deleted_at TIMESTAMP,  -- 软删除
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB,
  CONSTRAINT fk_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_conversations_user_updated ON conversations(user_id, updated_at DESC);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_conversations_search ON conversations USING GIN(to_tsvector('english', title));
```

### 5.2 全文搜索

使用 PostgreSQL `to_tsvector` 或 Elasticsearch 实现会话标题+消息内容搜索。

### 5.3 SSE 实现（Node.js 示例）

```typescript
app.post('/conversations/:id/messages', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const { conversationId } = req.params;
  const { content } = req.body;

  // 创建用户消息
  const userMessage = await createMessage(conversationId, 'user', content);

  // 调用 LLM API（流式）
  const stream = await llmClient.createChatCompletion({
    model: 'gpt-4',
    messages: await getConversationHistory(conversationId),
    stream: true,
  });

  let assistantContent = '';
  const messageId = generateId();

  res.write(`event: message.start\ndata: ${JSON.stringify({ messageId, role: 'assistant' })}\n\n`);

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    assistantContent += delta;
    res.write(`event: message.delta\ndata: ${JSON.stringify({ content: delta })}\n\n`);
  }

  // 保存 assistant 消息
  await createMessage(conversationId, 'assistant', assistantContent, { messageId });

  res.write(`event: message.done\ndata: ${JSON.stringify({ messageId, content: assistantContent })}\n\n`);
  res.end();
});
```

---

## 6. 测试清单

后端实现后，请确保以下测试通过：

- [ ] `GET /conversations` 返回分页列表
- [ ] `POST /conversations` 创建会话成功
- [ ] `GET /conversations/:id` 返回会话详情+消息
- [ ] `PUT /conversations/:id` 更新标题/标签
- [ ] `DELETE /conversations/:id` 软删除/硬删除
- [ ] `POST /conversations/:id/messages` SSE 流式返回
- [ ] 工具调用在 SSE 中正确推送（`tool.call` / `tool.result`）
- [ ] 错误情况下推送 `error` 事件
- [ ] 全文搜索正确匹配标题和消息内容
- [ ] 分页游标（`beforeMessageId`）正确工作

---

## 7. 前端迁移步骤

1. **移除 `store/index.ts` 的 localStorage 逻辑**
2. **安装 `@tanstack/react-query`**
3. **创建 `hooks/useConversations.ts` 等 hooks**
4. **PlaygroundsV3 接入 React Query**
5. **SSE 消息流集成到 ChatInput**
6. **测试刷新后会话恢复**

---

**协调完成标志**: 前端发送消息后，刷新页面仍能看到完整会话历史。
