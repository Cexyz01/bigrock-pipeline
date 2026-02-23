import { useState } from 'react'

export default function Card({ children, style, onClick, accent }) {
  const [h, setH] = useState(false)
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        background: '#fff',
        border: '1px solid #E8ECF1',
        borderRadius: 16, transition: 'all 0.2s ease', padding: 24,
        transform: h && onClick ? 'translateY(-2px)' : 'none',
        boxShadow: h ? '0 8px 24px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
        cursor: onClick ? 'pointer' : 'default',
        ...(accent ? { borderLeft: `3px solid ${accent}` } : {}),
        ...style,
      }}
    >{children}</div>
  )
}
