import { DB_QUERY, DB_EXECUTE, DB_TRANSACTION } from '../../../shared/ipc-channels'
import type { DbQueryRequest, DbExecuteRequest, DbTransactionRequest } from '../../../shared/ipc-types'
import type { IpcHandler } from '../router'
import { getDatabase, normalizeParams } from '../../database'

export const databaseHandlers: Record<string, IpcHandler<any, any>> = {
  [DB_QUERY]: async (_, req: DbQueryRequest): Promise<unknown[]> => {
    const db = getDatabase()
    const stmt = db.prepare(req.sql)
    const params = req.params ? normalizeParams(req.params) : []
    return stmt.all(...params)
  },

  [DB_EXECUTE]: async (_, req: DbExecuteRequest): Promise<{ changes: number; lastInsertRowid: number }> => {
    const db = getDatabase()
    const stmt = db.prepare(req.sql)
    const params = req.params ? normalizeParams(req.params) : []
    const info = stmt.run(...params)
    return {
      changes: info.changes,
      lastInsertRowid: Number(info.lastInsertRowid)
    }
  },

  [DB_TRANSACTION]: async (_, req: DbTransactionRequest): Promise<void> => {
    const db = getDatabase()
    const transaction = db.transaction(() => {
      for (const stmt of req.statements) {
        const prepared = db.prepare(stmt.sql)
        const params = stmt.params ? normalizeParams(stmt.params) : []
        prepared.run(...params)
      }
    })
    transaction()
  }
}
