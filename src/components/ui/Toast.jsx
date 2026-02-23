import { useState, useEffect, useCallback } from 'react'

let toastId = 0

export function useToast() {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', opts = {}) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type, body: opts.body, onClick: opts.onClick }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, addToast, removeToast }
}

export default function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null
  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 200,
      display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onRemove={() => onRemove(t.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  const borderColor = toast.type === 'success' ? '#6ee7a0' : toast.type === 'error' ? '#f07070' : '#6ea8fe'

  return (
    <div
      onClick={() => { if (toast.onClick) toast.onClick(); onRemove() }}
      style={{
        background: '#1e1e2e', border: '1px solid #2a2a3a', borderRadius: 12,
        padding: '14px 20px', minWidth: 300, maxWidth: 400,
        borderLeft: `3px solid ${borderColor}`,
        cursor: toast.onClick ? 'pointer' : 'default',
        pointerEvents: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
        transition: 'all 0.25s ease',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4ec' }}>{toast.message}</div>
      {toast.body && <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{toast.body}</div>}
    </div>
  )
}
