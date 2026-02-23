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
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#141420', border: '1px solid #1e1e2e', borderRadius: 22,
        padding: 28, width: '90%', maxWidth: 380, animation: 'fadeIn 0.15s ease',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#f0f0f5' }}>Conferma</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 24, lineHeight: 1.5 }}>{pending.message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn onClick={onCancel}>Annulla</Btn>
          <Btn variant="danger" onClick={onConfirm}>Elimina</Btn>
        </div>
      </div>
    </div>
  )
}
