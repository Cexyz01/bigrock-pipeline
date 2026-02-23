import { useState } from 'react'

export default function Btn({ children, onClick, variant = 'default', style = {}, disabled, loading }) {
  const [h, setH] = useState(false)
  const styles = {
    default: { bg: '#1a1a2a', hbg: '#222236', color: '#ccc', border: '#2a2a3e' },
    primary: { bg: 'rgba(205,255,0,0.10)', hbg: 'rgba(205,255,0,0.20)', color: '#CDFF00', border: 'rgba(205,255,0,0.3)' },
    danger: { bg: 'rgba(255,107,74,0.10)', hbg: 'rgba(255,107,74,0.20)', color: '#FF6B4A', border: 'rgba(255,107,74,0.25)' },
    success: { bg: 'rgba(78,205,196,0.10)', hbg: 'rgba(78,205,196,0.20)', color: '#4ECDC4', border: 'rgba(78,205,196,0.25)' },
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
        border: `1px solid ${styles.border}`, borderRadius: 14,
        padding: '10px 20px', fontSize: 13, fontWeight: 700,
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
