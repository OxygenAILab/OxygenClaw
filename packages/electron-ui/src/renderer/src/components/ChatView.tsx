import { useState, useEffect, useRef } from 'react'
import type { Message } from '../../../shared/ipc-types'
import { logger } from '../utils/logger'
import { toast } from './Toast'

interface Props {
  conversationId: string
  onBack: () => void
}

export function ChatView({ conversationId, onBack }: Props): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const loadMessages = async () => {
    try {
      const list = await window.api.message.list({ conversationId })
      setMessages(list)
      logger.info('Loaded messages', { conversationId, count: list.length })
      setTimeout(scrollToBottom, 100)
    } catch (error) {
      logger.error('Failed to load messages', { error })
      toast.error('加载消息失败')
    }
  }

  useEffect(() => {
    loadMessages()
  }, [conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || sending) return

    const content = input.trim()
    setInput('')
    setSending(true)

    try {
      const message = await window.api.message.send({
        conversationId,
        content
      })
      setMessages(prev => [...prev, message])
      logger.info('Sent message', { conversationId, messageId: message.id })
    } catch (error) {
      logger.error('Failed to send message', { error })
      toast.error('发送消息失败')
      setInput(content) // 恢复输入
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#F7F4EF'
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem 2rem',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E7E1D7',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <button
          onClick={onBack}
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
          ← 返回
        </button>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 500, color: '#1F2421' }}>
          对话
        </h2>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            color: '#5C635D'
          }}>
            暂无消息，发送一条开始对话
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}
            >
              <div style={{
                maxWidth: '70%',
                padding: '0.75rem 1rem',
                borderRadius: '12px',
                backgroundColor: msg.role === 'user' ? '#C4612F' : '#FFFFFF',
                color: msg.role === 'user' ? '#FFFFFF' : '#1F2421',
                border: msg.role === 'user' ? 'none' : '1px solid #E7E1D7',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word'
              }}>
                {msg.content}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '1rem 2rem',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E7E1D7'
      }}>
        <div style={{ display: 'flex', gap: '0.5rem', maxWidth: '1200px', margin: '0 auto' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="输入消息..."
            disabled={sending}
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
            onClick={handleSend}
            disabled={sending || !input.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: sending || !input.trim() ? '#E7E1D7' : '#C4612F',
              color: 'white',
              border: 'none',
              borderRadius: '999px',
              fontSize: '0.95rem',
              cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
              fontWeight: 500
            }}
          >
            {sending ? '发送中...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  )
}
