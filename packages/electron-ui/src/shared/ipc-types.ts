/**
 * IPC 类型定义
 * 主进程和渲染进程通信的请求/响应类型
 */

// ===== 通用响应包装 =====
export interface IpcResponse<T = unknown> {
  success: boolean
  data?: T
  error?: IpcError
}

export interface IpcError {
  code: string
  message: string
  stack?: string
  details?: Record<string, unknown>
}

// ===== 错误码 =====
export enum ErrorCode {
  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INVALID_REQUEST = 'INVALID_REQUEST',
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  // 数据库错误
  DB_CONNECTION_FAILED = 'DB_CONNECTION_FAILED',
  DB_QUERY_FAILED = 'DB_QUERY_FAILED',
  DB_TRANSACTION_FAILED = 'DB_TRANSACTION_FAILED',

  // 对话错误
  CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND',
  CONVERSATION_CREATE_FAILED = 'CONVERSATION_CREATE_FAILED',

  // 消息错误
  MESSAGE_NOT_FOUND = 'MESSAGE_NOT_FOUND',
  MESSAGE_SEND_FAILED = 'MESSAGE_SEND_FAILED',

  // 任务错误
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_ALREADY_CANCELLED = 'TASK_ALREADY_CANCELLED',
  TASK_CANCEL_FAILED = 'TASK_CANCEL_FAILED',

  // MCP 错误
  MCP_SERVER_NOT_FOUND = 'MCP_SERVER_NOT_FOUND',
  MCP_SERVER_START_FAILED = 'MCP_SERVER_START_FAILED',
  MCP_SERVER_ALREADY_EXISTS = 'MCP_SERVER_ALREADY_EXISTS',

  // 设置错误
  SETTINGS_LOAD_FAILED = 'SETTINGS_LOAD_FAILED',
  SETTINGS_SAVE_FAILED = 'SETTINGS_SAVE_FAILED'
}


// ===== 数据库 =====
export interface DbQueryRequest {
  sql: string
  params?: unknown[]
}

export interface DbExecuteRequest {
  sql: string
  params?: unknown[]
}

export interface DbTransactionRequest {
  statements: Array<{ sql: string; params?: unknown[] }>
}

// ===== 对话 =====
export interface Conversation {
  id: string
  title: string
  model: string
  createdAt: number
  updatedAt: number
}

export interface ConversationCreateRequest {
  title: string
  model?: string
}

export interface ConversationDeleteRequest {
  id: string
}

// ===== 消息 =====
export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string | ContentBlock[]
  createdAt: number
}

export interface ContentBlock {
  type: 'text' | 'image'
  text?: string
  source?: {
    type: 'base64'
    media_type: string
    data: string
  }
}

export interface MessageListRequest {
  conversationId: string
  limit?: number
  offset?: number
}

export interface MessageSendRequest {
  conversationId: string
  content: string
  model?: string
}

// ===== 任务 =====
export interface Task {
  id: string
  conversationId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  createdAt: number
  updatedAt: number
}

export interface TaskCancelRequest {
  id: string
}

// ===== 设置 =====
export interface Settings {
  theme: 'light' | 'dark' | 'system'
  language: string
  defaultModel: string
  apiKeys: Record<string, string>
}

export interface SettingsUpdateRequest {
  theme?: 'light' | 'dark' | 'system'
  language?: string
  defaultModel?: string
  apiKeys?: Record<string, string>
}

// ===== MCP =====
export interface McpServer {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  status: 'running' | 'stopped' | 'error'
}

export interface McpAddServerRequest {
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
}

export interface McpRemoveServerRequest {
  id: string
}

export interface McpRestartServerRequest {
  id: string
}

// ===== 日志 =====
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogFromRendererRequest {
  level: LogLevel
  message: string
  meta?: Record<string, unknown>
}
