import { ipcRouter } from './router'
import { IPC_PING } from '../../shared/ipc-channels'
import { conversationHandlers } from './handlers/conversation'
import { messageHandlers } from './handlers/message'
import { taskHandlers } from './handlers/task'
import { settingsHandlers } from './handlers/settings'
import { mcpHandlers } from './handlers/mcp'
import { databaseHandlers } from './handlers/database'
import { loggerHandlers } from './handlers/logger'
import { logger } from '../logger'

/**
 * 初始化所有 IPC 处理器
 */
export function initializeIpc(): void {
  logger.debug('[IPC] Initializing handlers...')

  // 测试 ping
  ipcRouter.register(IPC_PING, () => 'pong')

  // 日志处理器（优先注册，确保 renderer 日志可以转发）
  ipcRouter.registerMany(loggerHandlers)

  // 数据库操作
  ipcRouter.registerMany(databaseHandlers)

  // 业务模块
  ipcRouter.registerMany(conversationHandlers)
  ipcRouter.registerMany(messageHandlers)
  ipcRouter.registerMany(taskHandlers)
  ipcRouter.registerMany(settingsHandlers)
  ipcRouter.registerMany(mcpHandlers)

  logger.debug('[IPC] All handlers registered')
}

/**
 * 清理所有 IPC 处理器
 */
export function cleanupIpc(): void {
  logger.debug('[IPC] Cleaning up handlers...')
  ipcRouter.clear()
}
