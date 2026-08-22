import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core'

/**
 * 对话表
 */
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  model: text('model'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})

/**
 * 消息表
 */
export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  createdAt: integer('created_at').notNull()
}, (table) => ({
  conversationIdx: index('idx_messages_conversation').on(table.conversationId),
  createdAtIdx: index('idx_messages_created').on(table.createdAt)
}))

/**
 * 任务表
 */
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id')
    .references(() => conversations.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  status: text('status', {
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled']
  }).notNull(),
  result: text('result'),
  error: text('error'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
}, (table) => ({
  statusIdx: index('idx_tasks_status').on(table.status),
  conversationIdx: index('idx_tasks_conversation').on(table.conversationId)
}))

/**
 * 设置表（key-value 存储）
 */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON 序列化存储
  updatedAt: integer('updated_at').notNull()
})

/**
 * MCP 服务器表
 */
export const mcpServers = sqliteTable('mcp_servers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  command: text('command').notNull(),
  args: text('args').notNull(), // JSON 数组序列化
  env: text('env'), // JSON 对象序列化，可选
  status: text('status', {
    enum: ['running', 'stopped', 'error']
  }).notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull()
})
