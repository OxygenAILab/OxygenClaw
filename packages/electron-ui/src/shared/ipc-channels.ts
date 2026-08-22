/**
 * IPC 通道常量
 * 主进程(main)和渲染进程(renderer)通信的统一 channel 定义
 */

// ===== 测试 =====
export const IPC_PING = 'ipc:ping'

// ===== 数据库操作 =====
export const DB_QUERY = 'db:query'
export const DB_EXECUTE = 'db:execute'
export const DB_TRANSACTION = 'db:transaction'

// ===== 对话管理 =====
export const CONVERSATION_LIST = 'conversation:list'
export const CONVERSATION_GET = 'conversation:get'
export const CONVERSATION_CREATE = 'conversation:create'
export const CONVERSATION_DELETE = 'conversation:delete'

// ===== 消息管理 =====
export const MESSAGE_LIST = 'message:list'
export const MESSAGE_SEND = 'message:send'

// ===== 任务管理 =====
export const TASK_LIST = 'task:list'
export const TASK_GET = 'task:get'
export const TASK_CANCEL = 'task:cancel'

// ===== 设置 =====
export const SETTINGS_GET = 'settings:get'
export const SETTINGS_UPDATE = 'settings:update'

// ===== MCP 服务器 =====
export const MCP_LIST_SERVERS = 'mcp:listServers'
export const MCP_ADD_SERVER = 'mcp:addServer'
export const MCP_REMOVE_SERVER = 'mcp:removeServer'
export const MCP_RESTART_SERVER = 'mcp:restartServer'

// ===== 日志 =====
export const LOG_FROM_RENDERER = 'log:fromRenderer'

