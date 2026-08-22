import { useState, useEffect } from 'react'

interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
}

let toastId = 0
const toastListeners = new Set<(toast: ToastMessage) => void>()

/**
 * Toast 通知工具
 */
export const toast = {
  success: (message: string) => {
    const id = `toast-${toastId++}`
    toastListeners.forEach(listener => listener({ id, type: 'success', message }))
  },
  error: (message: string) => {
    const id = `toast-${toastId++}`
    toastListeners.forEach(listener => listener({ id, type: 'error', message }))
  },
  warning: (message: string) => {
    const id = `toast-${toastId++}`
    toastListeners.forEach(listener => listener({ id, type: 'warning', message }))
  },
  info: (message: string) => {
    const id = `toast-${toastId++}`
    toastListeners.forEach(listener => listener({ id, type: 'info', message }))
  }
}

/**
 * Toast 容器组件
 */
export function ToastContainer(): JSX.Element {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  useEffect(() => {
    const handleToast = (toast: ToastMessage) => {
      setToasts(prev => [...prev, toast])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id))
      }, 3000)
    }

    toastListeners.add(handleToast)
    return () => {
      toastListeners.delete(handleToast)
    }
  }, [])

  const getBackgroundColor = (type: string) => {
    switch (type) {
      case 'success': return '#10b981'
      case 'error': return '#ef4444'
      case 'warning': return '#f59e0b'
      case 'info': return '#3b82f6'
      default: return '#6b7280'
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: '1rem',
      right: '1rem',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem'
    }}>
      {toasts.map(toast => (
        <div
          key={toast.id}
          style={{
            backgroundColor: getBackgroundColor(toast.type),
            color: 'white',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            minWidth: '250px',
            maxWidth: '400px',
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}
