import { useState } from 'react'

export default function NavBtn({ icon, label, active, onClick, badge }) {
  const [h, setH] = useState(false)
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center',
        height: 44,
        cursor: 'pointer', userSelect: 'none', position: 'relative',
        background: active ? 'rgba(108,92,231,0.08)' : h ? '#F1F5F9' : 'transparent',
        color: active ? '#6C5CE7' : h ? '#334155' : '#64748B',
        transition: 'background 0.15s ease, color 0.15s ease',
        margin: '2px 0',
      }}
    >
      {/* Icon — always centered in the 72px icon rail, never moves */}
      <div style={{ width: 72, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      {/* Label — clipped by parent overflow:hidden when sidebar is 72px */}
      <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, whiteSpace: 'nowrap' }}>{label}</span>
      {badge > 0 && (
        <span style={{
          fontSize: 10, fontWeight: 700,
          background: '#EF4444', color: '#fff',
          padding: '1px 6px', borderRadius: 10,
          position: 'absolute', top: 6, left: 48,
          minWidth: 16, textAlign: 'center',
        }}>{badge}</span>
      )}
    </div>
  )
}
