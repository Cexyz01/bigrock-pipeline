import { useState, useRef, useEffect } from 'react'
import Calendar from './Calendar'
import { IconCalendar } from './Icons'

const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function formatDate(ymd) {
  if (!ymd) return ''
  const d = new Date(ymd + 'T00:00:00')
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export default function DateInput({
  value, onChange, placeholder = 'Seleziona data',
  style = {}, inputStyle = {}, minDate, maxDate,
  compact = false, popoverAlign = 'left', showIcon = true,
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const basePadding = compact ? '5px 10px' : '11px 14px'
  const baseFont = compact ? 12 : 13
  const baseRadius = compact ? 8 : 10
  const iconSize = compact ? 13 : 16

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: '#F8FAFC', border: `1px solid ${open ? '#F28C28' : '#E2E8F0'}`, borderRadius: baseRadius,
          padding: basePadding, color: value ? '#1a1a1a' : '#94A3B8', fontSize: baseFont, textAlign: 'left',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          boxShadow: open ? '0 0 0 3px rgba(242,140,40,0.08)' : 'none',
          fontFamily: 'inherit',
          ...inputStyle,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value ? formatDate(value) : placeholder}</span>
        {showIcon && <IconCalendar size={iconSize} color="#94A3B8" />}
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)',
          [popoverAlign]: 0,
          zIndex: 100, width: 280, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', borderRadius: 14,
        }}>
          <Calendar
            value={value}
            onChange={(v) => { onChange(v); setOpen(false) }}
            minDate={minDate}
            maxDate={maxDate}
          />
        </div>
      )}
    </div>
  )
}
