import { useState } from 'react'

export default function NavBtn({ icon, label, active, onClick, badge }) {
  const [h, setH] = useState(false)
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px', margin: '2px 10px', borderRadius: 14,
        cursor: 'pointer', userSelect: 'none', position: 'relative',
        background: active ? 'rgba(205,255,0,0.08)' : h ? '#1a1a2a' : 'transparent',
        transition: 'all 0.15s ease',
      }}
    >
      {active && <div style={{ position: 'absolute', left: 0, width: 3, height: 18, borderRadius: 2, background: '#CDFF00' }} />}
      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: active ? 600 : 400, color: active ? '#f0f0f5' : h ? '#b0b0c0' : '#777' }}>{label}</span>
      {badge > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,107,74,0.15)', color: '#FF6B4A', padding: '2px 7px', borderRadius: 10 }}>{badge}</span>}
    </div>
  )
}
