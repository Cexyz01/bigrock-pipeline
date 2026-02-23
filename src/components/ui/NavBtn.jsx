import { useState } from 'react'

export default function NavBtn({ icon, label, active, onClick, badge }) {
  const [h, setH] = useState(false)
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 18px', margin: '3px 12px', borderRadius: 16,
        cursor: 'pointer', userSelect: 'none', position: 'relative',
        background: active ? 'rgba(197,179,230,0.10)' : h ? 'rgba(255,255,255,0.04)' : 'transparent',
        transition: 'all 0.15s ease',
      }}
    >
      {active && <div style={{ position: 'absolute', left: 0, width: 3, height: 20, borderRadius: 2, background: '#C5B3E6' }} />}
      <span style={{ fontSize: 18, width: 26, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 14, fontWeight: active ? 600 : 400, color: active ? '#EEEEF5' : h ? '#9090B0' : '#606080' }}>{label}</span>
      {badge > 0 && <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,183,178,0.15)', color: '#FFB7B2', padding: '2px 8px', borderRadius: 20 }}>{badge}</span>}
    </div>
  )
}
