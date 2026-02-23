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
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#15151e', border: '1px solid #2a2a3a', borderRadius: 16,
        padding: 28, width: '90%', maxWidth: 380, animation: 'fadeIn 0.15s ease',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Conferma</div>
        <div style={{ fontSize: 14, color: '#aaa', marginBottom: 24, lineHeight: 1.5 }}>{pending.message}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Btn onClick={onCancel}>Annulla</Btn>
          <Btn variant="danger" onClick={onConfirm}>Elimina</Btn>
        </div>
      </div>
    </div>
  )
}
