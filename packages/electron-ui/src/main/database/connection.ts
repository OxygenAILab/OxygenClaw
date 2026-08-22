import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

let db: Database.Database | null = null

/**
 * 获取数据库单例连接
 */
export function getDatabase(): Database.Database {
  if (db) {
    return db
  }

  // 确保数据目录存在
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  const dbPath = join(dbDir, 'oxygenclaw.db')

  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
  })

  // 启用 WAL 模式（更好的并发性能）
  db.pragma('journal_mode = WAL')

  // 启用外键约束
  db.pragma('foreign_keys = ON')

  return db
}

/**
 * 关闭数据库连接
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

/**
 * 参数标准化：boolean→0/1, undefined→null, Date→毫秒时间戳
 * 复用 backend 的经验教训
 */
export function normalizeParams(params: any[]): any[] {
  return params.map(p => {
    if (typeof p === 'boolean') return p ? 1 : 0
    if (p === undefined) return null
    if (p instanceof Date) return p.getTime()
    return p
  })
}
