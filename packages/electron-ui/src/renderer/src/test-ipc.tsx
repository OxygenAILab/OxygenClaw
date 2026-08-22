import { useEffect, useState } from 'react'

interface TestResult {
  name: string
  status: 'pending' | 'success' | 'error'
  message?: string
}

export default function TestIPC() {
  const [results, setResults] = useState<TestResult[]>([])

  useEffect(() => {
    runTests()
  }, [])

  async function runTests() {
    const tests: TestResult[] = []

    // 测试 1: 创建对话
    try {
      tests.push({ name: '创建对话', status: 'pending' })
      const conv = await window.api.conversation.create({
        title: `端到端测试 ${new Date().toLocaleTimeString()}`
      })
      if (conv.id && conv.title) {
        tests[0] = { name: '创建对话', status: 'success', message: `ID: ${conv.id}` }

        // 测试 2: 发送消息
        tests.push({ name: '发送消息', status: 'pending' })
        setResults([...tests])

        const msg = await window.api.message.send({
          conversationId: conv.id,
          content: 'Hello from renderer!'
        })
        if (msg.id && msg.content === 'Hello from renderer!') {
          tests[1] = { name: '发送消息', status: 'success', message: `ID: ${msg.id}` }
        } else {
          tests[1] = { name: '发送消息', status: 'error', message: '返回数据不符' }
        }

        // 测试 3: 查询消息列表
        tests.push({ name: '查询消息列表', status: 'pending' })
        setResults([...tests])

        const messages = await window.api.message.list({ conversationId: conv.id })
        if (messages.length === 1 && messages[0].id === msg.id) {
          tests[2] = { name: '查询消息列表', status: 'success', message: `${messages.length} 条` }
        } else {
          tests[2] = { name: '查询消息列表', status: 'error', message: `预期 1 条，实际 ${messages.length} 条` }
        }

        // 测试 4: 查询对话列表
        tests.push({ name: '查询对话列表', status: 'pending' })
        setResults([...tests])

        const convs = await window.api.conversation.list()
        if (convs.length > 0 && convs.some(c => c.id === conv.id)) {
          tests[3] = { name: '查询对话列表', status: 'success', message: `${convs.length} 个对话` }
        } else {
          tests[3] = { name: '查询对话列表', status: 'error', message: '未找到刚创建的对话' }
        }

        // 测试 5: 设置读写
        tests.push({ name: '设置读写', status: 'pending' })
        setResults([...tests])

        await window.api.settings.update({ theme: 'dark' })
        const current = await window.api.settings.get()
        if (current.theme === 'dark') {
          tests[4] = { name: '设置读写', status: 'success', message: `theme=${current.theme}` }
        } else {
          tests[4] = { name: '设置读写', status: 'error', message: `预期 dark，实际 ${current.theme}` }
        }

        // 测试 6: 删除对话（级联删除消息）
        tests.push({ name: '删除对话', status: 'pending' })
        setResults([...tests])

        await window.api.conversation.delete({ id: conv.id })
        const afterDelete = await window.api.conversation.get(conv.id)
        const orphanMessages = await window.api.message.list({ conversationId: conv.id })
        if (afterDelete === null && orphanMessages.length === 0) {
          tests[5] = { name: '删除对话', status: 'success', message: '级联删除成功' }
        } else {
          tests[5] = { name: '删除对话', status: 'error', message: '级联删除失败' }
        }

      } else {
        tests[0] = { name: '创建对话', status: 'error', message: '返回数据不完整' }
      }
    } catch (error: any) {
      tests.push({ name: '测试异常', status: 'error', message: error.message })
    }

    setResults(tests)
  }

  const allSuccess = results.length > 0 && results.every(r => r.status === 'success')

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1 style={{ marginBottom: '1rem' }}>IPC + DB 端到端测试</h1>

      {results.length === 0 && <p>运行测试中...</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {results.map((result, i) => (
          <div
            key={i}
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid',
              borderColor: result.status === 'success' ? '#22c55e' : result.status === 'error' ? '#ef4444' : '#6b7280',
              backgroundColor: result.status === 'success' ? '#f0fdf4' : result.status === 'error' ? '#fef2f2' : '#f9fafb'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>
                {result.status === 'success' && '✅'}
                {result.status === 'error' && '❌'}
                {result.status === 'pending' && '⏳'}
              </span>
              <strong>{result.name}</strong>
            </div>
            {result.message && (
              <div style={{ marginTop: '0.25rem', fontSize: '0.875rem', color: '#6b7280' }}>
                {result.message}
              </div>
            )}
          </div>
        ))}
      </div>

      {allSuccess && (
        <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0fdf4', borderRadius: '0.5rem', border: '2px solid #22c55e' }}>
          <h2 style={{ color: '#16a34a', margin: 0 }}>🎉 全部测试通过！</h2>
          <p style={{ marginTop: '0.5rem', color: '#15803d' }}>
            IPC 架构 + SQLite 数据层已完整打通，Phase 1 Part 1-2 验证完成。
          </p>
        </div>
      )}
    </div>
  )
}
