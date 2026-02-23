import { useState } from 'react'

export default function Btn({ children, onClick, variant = 'default', style = {}, disabled, loading }) {
  const [h, setH] = useState(false)
  const styles = {
    default: { bg: '#1e1e2e', hbg: '#252535', color: '#ccc', border: '#2a2a3a' },
    primary: { bg: '#6ea8fe18', hbg: '#6ea8fe28', color: '#6ea8fe', border: '#6ea8fe30' },
    danger: { bg: '#f0707018', hbg: '#f0707028', color: '#f07070', border: '#f0707030' },
    success: { bg: '#6ee7a018', hbg: '#6ee7a028', color: '#6ee7a0', border: '#6ee7a030' },
  }[variant]
  const isDisabled = disabled || loading
  return (
    <button
      disabled={isDisabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        background: h && !isDisabled ? styles.hbg : styles.bg,
        color: styles.color,
        border: `1px solid ${styles.border}`, borderRadius: 10,
        padding: '10px 20px', fontSize: 13, fontWeight: 600,
        transition: 'all 0.15s ease',
        opacity: isDisabled ? 0.4 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        ...style,
      }}
    >
      {loading && <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
      {children}
    </button>
  )
}
