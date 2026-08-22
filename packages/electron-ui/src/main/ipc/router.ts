import { ipcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResponse } from '../../shared/ipc-types'
import { logger } from '../logger'

/**
 * IPC 处理器类型
 */
export type IpcHandler<TRequest = unknown, TResponse = unknown> = (
  event: IpcMainInvokeEvent,
  request: TRequest
) => Promise<TResponse> | TResponse

/**
 * IPC 路由注册表
 */
class IpcRouter {
  private handlers = new Map<string, IpcHandler<any, any>>()

  /**
   * 注册 IPC 处理器
   */
  register<TRequest = unknown, TResponse = unknown>(
    channel: string,
    handler: IpcHandler<TRequest, TResponse>
  ): void {
    if (this.handlers.has(channel)) {
      logger.warn(`[IPC] Channel ${channel} already registered, overwriting`)
    }

    this.handlers.set(channel, handler as IpcHandler<any, any>)

    // 注册到 Electron IPC
    ipcMain.handle(channel, async (event, request: TRequest) => {
      try {
        const data = await handler(event, request)
        return this.success(data)
      } catch (error) {
        logger.error(`[IPC] Handler error on channel ${channel}`, { error })
        return this.error(error)
      }
    })
  }

  /**
   * 批量注册处理器
   */
  registerMany(handlers: Record<string, IpcHandler<any, any>>): void {
    Object.entries(handlers).forEach(([channel, handler]) => {
      this.register(channel, handler)
    })
  }

  /**
   * 移除处理器
   */
  unregister(channel: string): void {
    this.handlers.delete(channel)
    ipcMain.removeHandler(channel)
  }

  /**
   * 清空所有处理器
   */
  clear(): void {
    this.handlers.forEach((_, channel) => {
      ipcMain.removeHandler(channel)
    })
    this.handlers.clear()
  }

  /**
   * 成功响应包装
   */
  private success<T>(data: T): IpcResponse<T> {
    return {
      success: true,
      data
    }
  }

  /**
   * 错误响应包装
   */
  private error(error: unknown): IpcResponse {
    const err = error as Error & { code?: string }
    return {
      success: false,
      error: {
        code: err.code || err.name || 'UNKNOWN_ERROR',
        message: err.message || 'An unknown error occurred',
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }
    }
  }
}

export const ipcRouter = new IpcRouter()
