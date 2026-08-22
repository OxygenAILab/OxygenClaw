/**
 * 渲染进程日志工具
 * 通过 IPC 将日志转发到主进程
 */

class Logger {
  debug(message: string, meta?: Record<string, unknown>): void {
    console.debug(`[Renderer] ${message}`, meta)
    window.api.log.debug(message, meta).catch(console.error)
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(`[Renderer] ${message}`, meta)
    window.api.log.info(message, meta).catch(console.error)
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[Renderer] ${message}`, meta)
    window.api.log.warn(message, meta).catch(console.error)
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[Renderer] ${message}`, meta)
    window.api.log.error(message, meta).catch(console.error)
  }
}

export const logger = new Logger()
