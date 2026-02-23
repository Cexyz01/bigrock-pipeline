import { IconX } from './Icons'

export default function Modal({ open, onClose, title, children, width }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', border: '1px solid #E8ECF1', borderRadius: 20,
        padding: 28, width: '90%', maxWidth: width || 540, maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        animation: 'scaleIn 0.2s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>{title}</h2>
          <button onClick={onClose} style={{ background: '#F1F5F9', border: 'none', color: '#64748B', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <IconX size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
