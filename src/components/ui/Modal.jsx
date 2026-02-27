import { IconX } from './Icons'
import useIsMobile from '../../hooks/useIsMobile'

export default function Modal({ open, onClose, title, children, width }) {
  const isMobile = useIsMobile()
  if (!open) return null

  if (isMobile) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(15,23,42,0.4)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }} onClick={onClose}>
        <div onClick={e => e.stopPropagation()} style={{
          background: '#fff', borderRadius: '20px 20px 0 0',
          padding: '20px 16px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
          animation: 'slideInUp 0.2s ease',
        }}>
          {/* Drag handle */}
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#CBD5E1', margin: '0 auto 14px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>{title}</h2>
            <button onClick={onClose} style={{ background: '#F1F5F9', border: 'none', color: '#64748B', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <IconX size={16} />
            </button>
          </div>
          {children}
        </div>
      </div>
    )
  }

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
