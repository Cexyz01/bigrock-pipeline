export default function Modal({ open, onClose, title, children, width }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#1c1c35', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 24,
        padding: 32, width: '90%', maxWidth: width || 560, maxHeight: '80vh', overflowY: 'auto',
        animation: 'fadeIn 0.2s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#EEEEF5' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#606080', fontSize: 20, cursor: 'pointer', padding: 4 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
