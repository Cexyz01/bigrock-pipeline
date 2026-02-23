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
      position: 'fixed', top: 24, right: 24, zIndex: 200,
      display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none',
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

  const borderColor = toast.type === 'success' ? '#A8E6CF' : toast.type === 'error' ? '#FFB7B2' : '#C5B3E6'

  return (
    <div
      onClick={() => { if (toast.onClick) toast.onClick(); onRemove() }}
      style={{
        background: '#1c1c35', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20,
        padding: '16px 22px', minWidth: 320, maxWidth: 420,
        borderLeft: `3px solid ${borderColor}`,
        cursor: toast.onClick ? 'pointer' : 'default',
        pointerEvents: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
        transition: 'all 0.25s ease',
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: '#EEEEF5' }}>{toast.message}</div>
      {toast.body && <div style={{ fontSize: 12, color: '#9090B0', marginTop: 4 }}>{toast.body}</div>}
    </div>
  )
}
