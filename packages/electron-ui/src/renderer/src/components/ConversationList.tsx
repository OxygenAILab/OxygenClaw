import { useState, useEffect } from 'react'
import type { Conversation } from '../../../shared/ipc-types'
import { logger } from '../utils/logger'
import { toast } from './Toast'

interface Props {
  onSelectConversation: (id: string) => void
}

export function ConversationList({ onSelectConversation }: Props): JSX.Element {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')

  const loadConversations = async () => {
    try {
      const list = await window.api.conversation.list()
      setConversations(list)
      logger.info('Loaded conversations', { count: list.length })
    } catch (error) {
      logger.error('Failed to load conversations', { error })
      toast.error('加载对话列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadConversations()
  }, [])

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.warning('请输入对话标题')
      return
    }

    try {
      const conversation = await window.api.conversation.create({
        title: newTitle.trim()
      })
      setConversations(prev => [conversation, ...prev])
      setNewTitle('')
      toast.success('创建对话成功')
      logger.info('Created conversation', { id: conversation.id })
    } catch (error) {
      logger.error('Failed to create conversation', { error })
      toast.error('创建对话失败')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个对话吗？')) return

    try {
      await window.api.conversation.delete({ id })
      setConversations(prev => prev.filter(c => c.id !== id))
      toast.success('删除对话成功')
      logger.info('Deleted conversation', { id })
    } catch (error) {
      logger.error('Failed to delete conversation', { error })
      toast.error('删除对话失败')
    }
  }

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>加载中...</div>
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', color: '#1F2421' }}>对话列表</h1>

      <div style={{ marginBottom: '2rem', display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          placeholder="输入对话标题..."
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            border: '1px solid #E7E1D7',
            borderRadius: '999px',
            fontSize: '0.95rem',
            outline: 'none',
            backgroundColor: '#FBF9F5'
          }}
        />
        <button
          onClick={handleCreate}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#C4612F',
            color: 'white',
            border: 'none',
            borderRadius: '999px',
            fontSize: '0.95rem',
            cursor: 'pointer',
            fontWeight: 500
          }}
        >
          创建
        </button>
      </div>

      {conversations.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          color: '#5C635D',
          backgroundColor: '#FBF9F5',
          borderRadius: '12px',
          border: '1px solid #E7E1D7'
        }}>
          暂无对话，创建一个开始吧
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {conversations.map(conv => (
            <div
              key={conv.id}
              style={{
                padding: '1rem 1.25rem',
                backgroundColor: '#FFFFFF',
                border: '1px solid #E7E1D7',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'box-shadow 0.2s',
                cursor: 'pointer'
              }}
              onClick={() => onSelectConversation(conv.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ flex: 1 }}>
                <h3 style={{
                  fontSize: '1rem',
                  fontWeight: 500,
                  marginBottom: '0.25rem',
                  color: '#1F2421'
                }}>
                  {conv.title}
                </h3>
                <div style={{ fontSize: '0.875rem', color: '#5C635D' }}>
                  {conv.model && <span>模型: {conv.model} · </span>}
                  {new Date(conv.updatedAt).toLocaleString('zh-CN')}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(conv.id)
                }}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: 'transparent',
                  color: '#C4612F',
                  border: '1px solid #C4612F',
                  borderRadius: '999px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
