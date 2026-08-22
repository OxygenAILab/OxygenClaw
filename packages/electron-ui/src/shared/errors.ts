import { ErrorCode } from './ipc-types'

/**
 * 业务异常基类
 */
export class AppError extends Error {
  code: string
  details?: Record<string, unknown>

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
  }
}

/**
 * 数据库异常
 */
export class DatabaseError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCode.DB_QUERY_FAILED, message, details)
    this.name = 'DatabaseError'
  }
}

/**
 * 对话异常
 */
export class ConversationError extends AppError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details)
    this.name = 'ConversationError'
  }

  static notFound(id: string): ConversationError {
    return new ConversationError(
      ErrorCode.CONVERSATION_NOT_FOUND,
      `Conversation ${id} not found`
    )
  }
}

/**
 * 消息异常
 */
export class MessageError extends AppError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details)
    this.name = 'MessageError'
  }

  static sendFailed(reason: string): MessageError {
    return new MessageError(ErrorCode.MESSAGE_SEND_FAILED, `Failed to send message: ${reason}`)
  }
}

/**
 * 任务异常
 */
export class TaskError extends AppError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details)
    this.name = 'TaskError'
  }

  static notFound(id: string): TaskError {
    return new TaskError(ErrorCode.TASK_NOT_FOUND, `Task ${id} not found`)
  }

  static alreadyCancelled(id: string): TaskError {
    return new TaskError(ErrorCode.TASK_ALREADY_CANCELLED, `Task ${id} already cancelled`)
  }
}

/**
 * MCP 异常
 */
export class McpError extends AppError {
  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(code, message, details)
    this.name = 'McpError'
  }

  static serverNotFound(id: string): McpError {
    return new McpError(ErrorCode.MCP_SERVER_NOT_FOUND, `MCP server ${id} not found`)
  }

  static startFailed(name: string, reason: string): McpError {
    return new McpError(
      ErrorCode.MCP_SERVER_START_FAILED,
      `Failed to start MCP server ${name}: ${reason}`
    )
  }
}
