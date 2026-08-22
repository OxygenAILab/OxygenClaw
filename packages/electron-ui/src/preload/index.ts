import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import * as IPC from '../shared/ipc-channels'
import type {
  Conversation,
  ConversationCreateRequest,
  ConversationDeleteRequest,
  Message,
  MessageListRequest,
  MessageSendRequest,
  Task,
  TaskCancelRequest,
  Settings,
  SettingsUpdateRequest,
  McpServer,
  McpAddServerRequest,
  McpRemoveServerRequest,
  McpRestartServerRequest,
  DbQueryRequest,
  DbExecuteRequest,
  DbTransactionRequest,
  LogLevel,
  LogFromRendererRequest
} from '../shared/ipc-types'

// Custom APIs for renderer
const api = {
  // 对话
  conversation: {
    list: () => ipcRenderer.invoke(IPC.CONVERSATION_LIST) as Promise<Conversation[]>,
    get: (id: string) => ipcRenderer.invoke(IPC.CONVERSATION_GET, { id }) as Promise<Conversation | null>,
    create: (req: ConversationCreateRequest) => ipcRenderer.invoke(IPC.CONVERSATION_CREATE, req) as Promise<Conversation>,
    delete: (req: ConversationDeleteRequest) => ipcRenderer.invoke(IPC.CONVERSATION_DELETE, req) as Promise<void>
  },

  // 消息
  message: {
    list: (req: MessageListRequest) => ipcRenderer.invoke(IPC.MESSAGE_LIST, req) as Promise<Message[]>,
    send: (req: MessageSendRequest) => ipcRenderer.invoke(IPC.MESSAGE_SEND, req) as Promise<Message>
  },

  // 任务
  task: {
    list: () => ipcRenderer.invoke(IPC.TASK_LIST) as Promise<Task[]>,
    get: (id: string) => ipcRenderer.invoke(IPC.TASK_GET, { id }) as Promise<Task | null>,
    cancel: (req: TaskCancelRequest) => ipcRenderer.invoke(IPC.TASK_CANCEL, req) as Promise<void>
  },

  // 设置
  settings: {
    get: () => ipcRenderer.invoke(IPC.SETTINGS_GET) as Promise<Settings>,
    update: (req: SettingsUpdateRequest) => ipcRenderer.invoke(IPC.SETTINGS_UPDATE, req) as Promise<Settings>
  },

  // MCP
  mcp: {
    list: () => ipcRenderer.invoke(IPC.MCP_LIST_SERVERS) as Promise<McpServer[]>,
    add: (req: McpAddServerRequest) => ipcRenderer.invoke(IPC.MCP_ADD_SERVER, req) as Promise<McpServer>,
    remove: (req: McpRemoveServerRequest) => ipcRenderer.invoke(IPC.MCP_REMOVE_SERVER, req) as Promise<void>,
    restart: (req: McpRestartServerRequest) => ipcRenderer.invoke(IPC.MCP_RESTART_SERVER, req) as Promise<void>
  },

  // 数据库（低级 API，一般业务代码不直接用）
  db: {
    query: (req: DbQueryRequest) => ipcRenderer.invoke(IPC.DB_QUERY, req) as Promise<unknown[]>,
    execute: (req: DbExecuteRequest) => ipcRenderer.invoke(IPC.DB_EXECUTE, req) as Promise<{ changes: number; lastInsertRowid: number }>,
    transaction: (req: DbTransactionRequest) => ipcRenderer.invoke(IPC.DB_TRANSACTION, req) as Promise<void>
  },

  // 日志
  log: {
    debug: (message: string, meta?: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC.LOG_FROM_RENDERER, { level: 'debug', message, meta } as LogFromRendererRequest),
    info: (message: string, meta?: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC.LOG_FROM_RENDERER, { level: 'info', message, meta } as LogFromRendererRequest),
    warn: (message: string, meta?: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC.LOG_FROM_RENDERER, { level: 'warn', message, meta } as LogFromRendererRequest),
    error: (message: string, meta?: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC.LOG_FROM_RENDERER, { level: 'error', message, meta } as LogFromRendererRequest)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

