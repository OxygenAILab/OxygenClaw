import winston from 'winston'
import path from 'path'
import { app } from 'electron'

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * 日志配置
 */
interface LoggerConfig {
  level: LogLevel
  maxFiles: number
  maxSize: string
}

const config: LoggerConfig = {
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  maxFiles: 7, // 保留 7 天
  maxSize: '10m' // 单文件最大 10MB
}

/**
 * 获取日志目录
 */
function getLogDir(): string {
  return path.join(app.getPath('userData'), 'logs')
}

/**
 * Main 进程日志器
 */
export const mainLogger = winston.createLogger({
  level: config.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    // 控制台输出（开发模式）
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''
          return `[${timestamp}] ${level}: ${message} ${metaStr}`
        })
      )
    }),
    // 文件输出 - 所有日志
    new winston.transports.File({
      filename: path.join(getLogDir(), 'main.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: config.maxFiles,
      tailable: true
    }),
    // 文件输出 - 仅错误
    new winston.transports.File({
      filename: path.join(getLogDir(), 'main-error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: config.maxFiles,
      tailable: true
    })
  ]
})

/**
 * Renderer 进程日志缓冲
 * Renderer 日志通过 IPC 转发到 Main，这里负责写入文件
 */
export const rendererLogger = winston.createLogger({
  level: config.level,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(getLogDir(), 'renderer.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: config.maxFiles,
      tailable: true
    }),
    new winston.transports.File({
      filename: path.join(getLogDir(), 'renderer-error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: config.maxFiles,
      tailable: true
    })
  ]
})

/**
 * 日志元数据接口
 */
export interface LogMeta {
  [key: string]: unknown
}

/**
 * 主进程日志 API
 */
export const logger = {
  debug: (message: string, meta?: LogMeta) => mainLogger.debug(message, meta),
  info: (message: string, meta?: LogMeta) => mainLogger.info(message, meta),
  warn: (message: string, meta?: LogMeta) => mainLogger.warn(message, meta),
  error: (message: string, meta?: LogMeta) => mainLogger.error(message, meta)
}

/**
 * 记录 Renderer 进程日志
 */
export function logFromRenderer(level: LogLevel, message: string, meta?: LogMeta): void {
  rendererLogger.log(level, message, { ...meta, source: 'renderer' })
}
