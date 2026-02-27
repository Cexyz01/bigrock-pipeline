import { useState, useEffect } from 'react'

export default function Fade({ children, delay = 0, style }) {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t) }, [delay])
  return (
    <div style={{
      opacity: show ? 1 : 0,
      transform: show ? 'translateY(0)' : 'translateY(8px)',
      transition: 'all 0.3s ease',
      ...style,
    }}>{children}</div>
  )
}
