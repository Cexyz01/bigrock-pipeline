import { useState } from 'react'

export default function Btn({ children, onClick, variant = 'default', style = {}, disabled, loading }) {
  const [h, setH] = useState(false)
  const styles = {
    default: { bg: '#1e1e2e', hbg: '#252538', color: '#ccc', border: '#2a2a3e' },
    primary: { bg: 'rgba(124,92,252,0.12)', hbg: 'rgba(124,92,252,0.22)', color: '#a78bfa', border: 'rgba(124,92,252,0.3)' },
    danger: { bg: 'rgba(255,107,107,0.1)', hbg: 'rgba(255,107,107,0.18)', color: '#ff6b6b', border: 'rgba(255,107,107,0.25)' },
    success: { bg: 'rgba(78,205,196,0.1)', hbg: 'rgba(78,205,196,0.18)', color: '#4ecdc4', border: 'rgba(78,205,196,0.25)' },
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
        border: `1px solid ${styles.border}`, borderRadius: 12,
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
