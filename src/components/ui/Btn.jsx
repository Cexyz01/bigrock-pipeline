import { useState } from 'react'

export default function Btn({ children, onClick, variant = 'default', style = {}, disabled, loading }) {
  const [h, setH] = useState(false)
  const styles = {
    default: { bg: '#F1F5F9', hbg: '#E2E8F0', color: '#475569', hcolor: null, border: '#E2E8F0' },
    primary: { bg: '#F28C28', hbg: '#1a1a1a', color: '#fff', hcolor: '#F28C28', border: '#F28C28' },
    danger: { bg: '#EF4444', hbg: '#DC2626', color: '#fff', hcolor: null, border: '#EF4444' },
    warning: { bg: '#FFFBEB', hbg: '#FEF3C7', color: '#D97706', hcolor: null, border: '#FDE68A' },
    success: { bg: '#ECFDF5', hbg: '#D1FAE5', color: '#059669', hcolor: null, border: '#A7F3D0' },
    info: { bg: '#EBF5FB', hbg: '#DBEAFE', color: '#2563EB', hcolor: null, border: '#BFDBFE' },
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
        color: h && !isDisabled && styles.hcolor ? styles.hcolor : styles.color,
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
