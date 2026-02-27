import { useState } from 'react'

export default function Btn({ children, onClick, variant = 'default', style = {}, disabled, loading }) {
  const [h, setH] = useState(false)
  const styles = {
    default: { bg: '#F1F5F9', hbg: '#E2E8F0', color: '#475569', border: '#E2E8F0' },
    primary: { bg: '#6C5CE7', hbg: '#5A4BD1', color: '#fff', border: '#6C5CE7' },
    danger: { bg: '#FEF2F2', hbg: '#FEE2E2', color: '#EF4444', border: '#FECACA' },
    warning: { bg: '#FFFBEB', hbg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
    success: { bg: '#ECFDF5', hbg: '#D1FAE5', color: '#059669', border: '#A7F3D0' },
    info: { bg: '#EBF5FB', hbg: '#DBEAFE', color: '#2563EB', border: '#BFDBFE' },
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
        padding: '9px 18px', fontSize: 13, fontWeight: 600,
        transition: 'all 0.15s ease',
        opacity: isDisabled ? 0.5 : 1,
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
