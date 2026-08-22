import {
  CONVERSATION_LIST,
  CONVERSATION_GET,
  CONVERSATION_CREATE,
  CONVERSATION_DELETE
} from '../../../shared/ipc-channels'
import type {
  Conversation,
  ConversationCreateRequest,
  ConversationDeleteRequest
} from '../../../shared/ipc-types'
import type { IpcHandler } from '../router'
import { getDatabase } from '../../database'

/**
 * 对话相关处理器
 */
export const conversationHandlers: Record<string, IpcHandler<any, any>> = {
  [CONVERSATION_LIST]: async (): Promise<Conversation[]> => {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as any[]
    return rows.map(row => ({
      id: row.id,
      title: row.title,
      model: row.model,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  },

  [CONVERSATION_GET]: async (_, { id }: { id: string }): Promise<Conversation | null> => {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as any
    if (!row) return null
    return {
      id: row.id,
      title: row.title,
      model: row.model,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  },

  [CONVERSATION_CREATE]: async (_, req: ConversationCreateRequest): Promise<Conversation> => {
    const db = getDatabase()
    const now = Date.now()
    const id = `conv_${now}_${Math.random().toString(36).slice(2, 9)}`

    db.prepare(`
      INSERT INTO conversations (id, title, model, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, req.title, req.model || null, now, now)

    return {
      id,
      title: req.title,
      model: req.model,
      createdAt: now,
      updatedAt: now
    }
  },

  [CONVERSATION_DELETE]: async (_, req: ConversationDeleteRequest): Promise<void> => {
    const db = getDatabase()
    db.prepare('DELETE FROM conversations WHERE id = ?').run(req.id)
  }
}
