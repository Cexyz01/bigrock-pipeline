import { useState } from 'react'

export default function Pill({ label, active, onClick }) {
  const [h, setH] = useState(false)
  return (
    <span
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 500,
        cursor: 'pointer', userSelect: 'none',
        background: active ? '#6C5CE7' : h ? '#E8ECF1' : '#F1F5F9',
        color: active ? '#fff' : h ? '#334155' : '#64748B',
        border: 'none',
        transition: 'all 0.15s ease', whiteSpace: 'nowrap',
      }}
    >{label}</span>
  )
}
