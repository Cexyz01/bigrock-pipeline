import { useState } from 'react'

export default function Pill({ label, active, onClick }) {
  const [h, setH] = useState(false)
  return (
    <span
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: active ? 700 : 400,
        cursor: 'pointer', userSelect: 'none',
        background: active ? 'rgba(205,255,0,0.12)' : h ? '#1a1a2a' : 'transparent',
        color: active ? '#CDFF00' : h ? '#ccc' : '#777',
        border: `1px solid ${active ? 'rgba(205,255,0,0.3)' : 'transparent'}`,
        transition: 'all 0.15s ease', whiteSpace: 'nowrap',
      }}
    >{label}</span>
  )
}
