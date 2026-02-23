import { useState } from 'react'

export default function Card({ children, style, onClick, accent }) {
  const [h, setH] = useState(false)
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        background: h ? '#232345' : '#1c1c35',
        border: `1px solid ${h ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 24, transition: 'all 0.2s ease', padding: 28,
        transform: h && onClick ? 'translateY(-2px)' : 'none',
        boxShadow: h ? '0 8px 32px rgba(0,0,0,0.3)' : 'none',
        cursor: onClick ? 'pointer' : 'default',
        ...(accent ? { borderTop: `2px solid ${accent}` } : {}),
        ...style,
      }}
    >{children}</div>
  )
}
