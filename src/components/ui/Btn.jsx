import { useState } from 'react'

export default function Btn({ children, onClick, variant = 'default', style = {}, disabled, loading }) {
  const [h, setH] = useState(false)
  const styles = {
    default: { bg: '#1c1c35', hbg: '#232345', color: '#9090B0', border: 'rgba(255,255,255,0.06)' },
    primary: { bg: 'rgba(197,179,230,0.10)', hbg: 'rgba(197,179,230,0.20)', color: '#C5B3E6', border: 'rgba(197,179,230,0.25)' },
    danger: { bg: 'rgba(255,183,178,0.10)', hbg: 'rgba(255,183,178,0.20)', color: '#FFB7B2', border: 'rgba(255,183,178,0.25)' },
    success: { bg: 'rgba(168,230,207,0.10)', hbg: 'rgba(168,230,207,0.20)', color: '#A8E6CF', border: 'rgba(168,230,207,0.25)' },
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
        border: `1px solid ${styles.border}`, borderRadius: 16,
        padding: '11px 22px', fontSize: 13, fontWeight: 700,
        transition: 'all 0.15s ease',
        opacity: isDisabled ? 0.4 : 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 8,
        ...style,
      }}
    >
      {loading && <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
      {children}
    </button>
  )
}
