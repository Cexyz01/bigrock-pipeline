import { useState } from 'react'

export default function Card({ children, style, onClick, accent }) {
  const [h, setH] = useState(false)
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        background: h ? '#1a1a2a' : '#141420',
        border: `1px solid ${h ? '#2a2a3e' : '#1e1e2e'}`,
        borderRadius: 22, transition: 'all 0.2s ease', padding: 24,
        transform: h && onClick ? 'translateY(-2px)' : 'none',
        boxShadow: h ? '0 8px 32px rgba(0,0,0,0.3)' : 'none',
        cursor: onClick ? 'pointer' : 'default',
        ...(accent ? { borderTop: `2px solid ${accent}` } : {}),
        ...style,
      }}
    >{children}</div>
  )
}
