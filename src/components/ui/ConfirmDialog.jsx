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
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1c1c35', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24,
        padding: 32, width: '90%', maxWidth: 400, animation: 'fadeIn 0.15s ease',
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10, color: '#EEEEF5' }}>Conferma</div>
        <div style={{ fontSize: 14, color: '#9090B0', marginBottom: 28, lineHeight: 1.6 }}>{pending.message}</div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Btn onClick={onCancel}>Annulla</Btn>
          <Btn variant="danger" onClick={onConfirm}>Elimina</Btn>
        </div>
      </div>
    </div>
  )
}
