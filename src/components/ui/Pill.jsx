import { useState } from 'react'

export default function Pill({ label, active, onClick }) {
  const [h, setH] = useState(false)
  return (
    <span
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        padding: '7px 16px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400,
        cursor: 'pointer', userSelect: 'none',
        background: active ? 'rgba(197,179,230,0.12)' : h ? 'rgba(255,255,255,0.04)' : 'transparent',
        color: active ? '#C5B3E6' : h ? '#9090B0' : '#606080',
        border: `1px solid ${active ? 'rgba(197,179,230,0.3)' : 'transparent'}`,
        transition: 'all 0.15s ease', whiteSpace: 'nowrap',
      }}
    >{label}</span>
  )
}
