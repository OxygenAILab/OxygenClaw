import { MESSAGE_LIST, MESSAGE_SEND } from '../../../shared/ipc-channels'
import type { Message, MessageListRequest, MessageSendRequest } from '../../../shared/ipc-types'
import type { IpcHandler } from '../router'
import { getDatabase } from '../../database'

export const messageHandlers: Record<string, IpcHandler<any, any>> = {
  [MESSAGE_LIST]: async (_, req: MessageListRequest): Promise<Message[]> => {
    const db = getDatabase()
    const rows = db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(req.conversationId) as any[]

    return rows.map(row => ({
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      createdAt: row.created_at
    }))
  },

  [MESSAGE_SEND]: async (_, req: MessageSendRequest): Promise<Message> => {
    const db = getDatabase()
    const now = Date.now()
    const id = `msg_${now}_${Math.random().toString(36).slice(2, 9)}`

    // 插入用户消息
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, req.conversationId, 'user', req.content, now)

    // 更新对话的 updated_at
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
      .run(now, req.conversationId)

    // TODO: Phase 2+ 调用 LLM 生成 assistant 回复

    return {
      id,
      conversationId: req.conversationId,
      role: 'user',
      content: req.content,
      createdAt: now
    }
  }
}
