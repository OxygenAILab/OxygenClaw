import { ElectronAPI } from '@electron-toolkit/preload'
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
  DbTransactionRequest
} from '../../shared/ipc-types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      conversation: {
        list: () => Promise<Conversation[]>
        get: (id: string) => Promise<Conversation | null>
        create: (req: ConversationCreateRequest) => Promise<Conversation>
        delete: (req: ConversationDeleteRequest) => Promise<void>
      }
      message: {
        list: (req: MessageListRequest) => Promise<Message[]>
        send: (req: MessageSendRequest) => Promise<Message>
      }
      task: {
        list: () => Promise<Task[]>
        get: (id: string) => Promise<Task | null>
        cancel: (req: TaskCancelRequest) => Promise<void>
      }
      settings: {
        get: () => Promise<Settings>
        update: (req: SettingsUpdateRequest) => Promise<Settings>
      }
      mcp: {
        list: () => Promise<McpServer[]>
        add: (req: McpAddServerRequest) => Promise<McpServer>
        remove: (req: McpRemoveServerRequest) => Promise<void>
        restart: (req: McpRestartServerRequest) => Promise<void>
      }
      db: {
        query: (req: DbQueryRequest) => Promise<unknown[]>
        execute: (req: DbExecuteRequest) => Promise<{ changes: number; lastInsertRowid: number }>
        transaction: (req: DbTransactionRequest) => Promise<void>
      }
    }
  }
}

export {}
