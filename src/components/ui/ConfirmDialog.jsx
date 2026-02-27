import { useState, useCallback } from 'react'
import Btn from './Btn'

export function useConfirm() {
  const [pending, setPending] = useState(null)
  const requestConfirm = useCallback((message, onConfirm) => {
    setPending({ message, onConfirm })
  }, [])
  const confirm = useCallback(() => {
    if (pending?.onConfirm) pending.onConfirm()
    setPending(null)
  }, [pending])
  const cancel = useCallback(() => setPending(null), [])
  return { pending, requestConfirm, confirm, cancel }
}

export default function ConfirmDialog({ pending, onConfirm, onCancel }) {
  if (!pending) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 150,
      background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', border: '1px solid #E8ECF1', borderRadius: 16,
        padding: 28, width: '90%', maxWidth: 400, animation: 'scaleIn 0.15s ease',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#1a1a2e' }}>Confirm</div>
        <div style={{ fontSize: 14, color: '#64748B', marginBottom: 24, lineHeight: 1.6 }}>{pending.message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn onClick={onCancel}>Cancel</Btn>
          <Btn variant="danger" onClick={onConfirm}>Confirm</Btn>
        </div>
      </div>
    </div>
  )
}
