import { useState } from 'react'

export default function Card({ children, style, onClick }) {
  const [h, setH] = useState(false)
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        background: h ? '#1a1a24' : '#15151e',
        border: `1px solid ${h ? '#2c2c3a' : '#1e1e2a'}`,
        borderRadius: 16, transition: 'all 0.2s ease', padding: 24,
        transform: h && onClick ? 'translateY(-1px)' : 'none',
        boxShadow: h ? '0 6px 24px rgba(0,0,0,0.2)' : 'none',
        cursor: onClick ? 'pointer' : 'default', ...style,
      }}
    >{children}</div>
  )
}
