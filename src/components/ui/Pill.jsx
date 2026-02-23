import { useState } from 'react'

export default function Pill({ label, active, onClick }) {
  const [h, setH] = useState(false)
  return (
    <span
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 600 : 400,
        cursor: 'pointer', userSelect: 'none',
        background: active ? '#6ea8fe18' : h ? '#1a1a24' : 'transparent',
        color: active ? '#6ea8fe' : h ? '#ccc' : '#777',
        border: `1px solid ${active ? '#6ea8fe30' : 'transparent'}`,
        transition: 'all 0.15s ease', whiteSpace: 'nowrap',
      }}
    >{label}</span>
  )
}
