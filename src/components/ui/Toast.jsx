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

  const accent = toast.type === 'success' ? '#10B981' : toast.type === 'error' ? '#EF4444' : '#6C5CE7'

  return (
    <div
      onClick={() => { if (toast.onClick) toast.onClick(); onRemove() }}
      style={{
        background: '#fff', border: '1px solid #E8ECF1', borderRadius: 12,
        padding: '14px 18px', minWidth: 300, maxWidth: 400,
        borderLeft: `3px solid ${accent}`,
        cursor: toast.onClick ? 'pointer' : 'default',
        pointerEvents: 'auto',
        boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
        transition: 'all 0.25s ease',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{toast.message}</div>
      {toast.body && <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>{toast.body}</div>}
    </div>
  )
}
