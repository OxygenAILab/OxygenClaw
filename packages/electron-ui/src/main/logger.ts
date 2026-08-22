import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { app } from 'electron'
import { join } from 'path'

/**
 * 日志格式化
 */
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`
  })
)

/**
 * 日志存储目录
 */
const logDir = join(app.getPath('userData'), 'logs')

/**
 * 主进程日志实例
 */
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: customFormat,
  transports: [
    // 控制台输出（开发环境）
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), customFormat)
    }),
    // 文件输出 - 所有日志
    new DailyRotateFile({
      dirname: logDir,
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      level: 'debug'
    }),
    // 文件输出 - 仅错误
    new DailyRotateFile({
      dirname: logDir,
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      level: 'error'
    })
  ]
})

/**
 * 处理来自渲染进程的日志
 */
export function logFromRenderer(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>
): void {
  logger.log(level, `[Renderer] ${message}`, meta)
}
