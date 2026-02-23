import { useState } from 'react'

export default function Pill({ label, active, onClick }) {
  const [h, setH] = useState(false)
  return (
    <span
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 10, fontSize: 12, fontWeight: active ? 600 : 400,
        cursor: 'pointer', userSelect: 'none',
        background: active ? 'rgba(124,92,252,0.15)' : h ? '#161622' : 'transparent',
        color: active ? '#a78bfa' : h ? '#ccc' : '#777',
        border: `1px solid ${active ? 'rgba(124,92,252,0.3)' : 'transparent'}`,
        transition: 'all 0.15s ease', whiteSpace: 'nowrap',
      }}
    >{label}</span>
  )
}
