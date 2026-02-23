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
        padding: '10px 16px', margin: '2px 10px', borderRadius: 12,
        cursor: 'pointer', userSelect: 'none', position: 'relative',
        background: active ? 'rgba(124,92,252,0.12)' : h ? '#161622' : 'transparent',
        transition: 'all 0.15s ease',
      }}
    >
      {active && <div style={{ position: 'absolute', left: 0, width: 3, height: 18, borderRadius: 2, background: '#7c5cfc' }} />}
      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: active ? 600 : 400, color: active ? '#e8e8f0' : h ? '#b0b0c0' : '#777' }}>{label}</span>
      {badge > 0 && <span style={{ fontSize: 10, fontWeight: 600, background: 'rgba(255,107,107,0.15)', color: '#ff6b6b', padding: '2px 7px', borderRadius: 10 }}>{badge}</span>}
    </div>
  )
}
