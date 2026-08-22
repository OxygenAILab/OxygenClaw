import { LOG_FROM_RENDERER } from '../../../shared/ipc-channels'
import type { LogFromRendererRequest } from '../../../shared/ipc-types'
import type { IpcHandler } from '../router'
import { logFromRenderer } from '../../logger'

/**
 * 日志相关处理器
 */
export const loggerHandlers: Record<string, IpcHandler<any, any>> = {
  [LOG_FROM_RENDERER]: async (_, req: LogFromRendererRequest): Promise<void> => {
    logFromRenderer(req.level, req.message, req.meta)
  }
}
