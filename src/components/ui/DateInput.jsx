import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import Calendar from './Calendar'
import { IconCalendar } from './Icons'

const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const POPOVER_W = 280
const POPOVER_H = 320 // approximate — used only for clamping the top edge

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
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const popoverRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  // Outside-click + scroll/resize repositioning
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target)) return
      if (popoverRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const place = () => {
      const r = triggerRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      // Default: below the trigger
      let top = r.bottom + 6
      // Flip above if there isn't enough room below
      if (top + POPOVER_H > vh - 8 && r.top > POPOVER_H + 8) top = r.top - POPOVER_H - 6
      // Horizontal: align to the requested edge, clamp to viewport
      let left = popoverAlign === 'right' ? r.right - POPOVER_W : r.left
      left = Math.max(8, Math.min(left, vw - POPOVER_W - 8))
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true) // capture: catch nested scroll containers
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, popoverAlign])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const basePadding = compact ? '5px 10px' : '11px 14px'
  const baseFont = compact ? 12 : 13
  const baseRadius = compact ? 8 : 10
  const iconSize = compact ? 13 : 16

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      <button
        ref={triggerRef}
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
      {open && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed', top: pos.top, left: pos.left,
            width: POPOVER_W, zIndex: 100000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', borderRadius: 14,
          }}
        >
          <Calendar
            value={value}
            onChange={(v) => { onChange(v); setOpen(false) }}
            minDate={minDate}
            maxDate={maxDate}
          />
        </div>,
        document.body,
      )}
    </div>
  )
}
