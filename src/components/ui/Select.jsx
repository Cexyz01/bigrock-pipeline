import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ACCENT } from '../../lib/constants'

// Drop-in replacement for the previous native-<select> wrapper.
// Same API: { value, onChange, options, placeholder, style }
// Adds: typeahead search, portal-rendered menu, auto-flip up, animation.
export default function Select({ value, onChange, options = [], placeholder, style = {} }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [menuRect, setMenuRect] = useState(null)
  const [flipUp, setFlipUp] = useState(false)
  const [mounted, setMounted] = useState(false)
  const triggerRef = useRef(null)
  const menuRef = useRef(null)
  const inputRef = useRef(null)

  // Show animation only after first mount to avoid initial flicker.
  useEffect(() => { setMounted(true) }, [])

  const selected = options.find(o => o.value === value)

  const filtered = useMemo(() => {
    if (!query.trim()) return options
    const q = query.trim().toLowerCase()
    return options.filter(o => String(o.label).toLowerCase().includes(q))
  }, [options, query])

  // Position the floating menu under (or above) the trigger.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const update = () => {
      const r = triggerRef.current.getBoundingClientRect()
      const vh = window.innerHeight
      const preferred = 280
      const spaceBelow = vh - r.bottom
      const spaceAbove = r.top
      const up = spaceBelow < preferred && spaceAbove > spaceBelow
      setFlipUp(up)
      setMenuRect({
        left: r.left + window.scrollX,
        width: r.width,
        top: up
          ? r.top + window.scrollY - 6
          : r.bottom + window.scrollY + 6,
        maxHeight: Math.min(preferred, Math.max(140, up ? spaceAbove - 16 : spaceBelow - 16)),
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Focus search input + reset query each time we open.
  useEffect(() => {
    if (!open) { setQuery(''); return }
    const id = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  const handlePick = (v) => {
    onChange?.(v)
    setOpen(false)
  }

  const display = selected?.label
  const showPlaceholder = !display

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: '#F8FAFC', border: `1px solid ${open ? ACCENT + '66' : '#E2E8F0'}`,
          borderRadius: 10, padding: '11px 14px',
          color: showPlaceholder ? '#94A3B8' : '#1a1a1a',
          fontSize: 13, fontFamily: 'inherit', textAlign: 'left',
          outline: 'none', cursor: 'pointer',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxShadow: open ? `0 0 0 3px ${ACCENT}1A` : 'none',
          ...style,
        }}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {display || placeholder || 'Select…'}
        </span>
        <span style={{
          fontSize: 9, color: '#94A3B8', flexShrink: 0,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s ease',
        }}>▼</span>
      </button>

      {mounted && open && menuRect && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'absolute',
            left: menuRect.left,
            top: flipUp ? 'auto' : menuRect.top,
            bottom: flipUp ? (window.innerHeight - menuRect.top + window.scrollY) : 'auto',
            width: menuRect.width,
            maxHeight: menuRect.maxHeight,
            background: '#fff',
            borderRadius: 12,
            border: '1px solid #E2E8F0',
            boxShadow: '0 12px 40px rgba(15,23,42,0.14)',
            zIndex: 9999,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            transformOrigin: flipUp ? 'bottom center' : 'top center',
            animation: `bigrock-select-in 0.16s cubic-bezier(0.16, 1, 0.3, 1)`,
          }}
        >
          <style>{`
            @keyframes bigrock-select-in {
              from { opacity: 0; transform: translateY(${flipUp ? '6px' : '-6px'}) scale(0.98); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          {options.length > 6 && (
            <div style={{ padding: 8, borderBottom: '1px solid #F1F5F9' }}>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Cerca..."
                style={{
                  width: '100%', padding: '7px 10px', fontSize: 12,
                  border: '1px solid #E2E8F0', borderRadius: 8,
                  outline: 'none', background: '#F8FAFC',
                  boxSizing: 'border-box', fontFamily: 'inherit',
                }}
              />
            </div>
          )}

          <div style={{ overflowY: 'auto', padding: 4, flex: 1 }}>
            {placeholder && !query && (
              <Option
                label={placeholder}
                muted
                active={!selected}
                onClick={() => handlePick('')}
              />
            )}
            {filtered.length === 0 && (
              <div style={{ padding: '10px 12px', fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>
                Nessun risultato
              </div>
            )}
            {filtered.map(o => (
              <Option
                key={o.value}
                label={o.label}
                active={o.value === value}
                onClick={() => handlePick(o.value)}
              />
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

function Option({ label, active, muted, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        padding: '8px 10px', border: 'none', borderRadius: 8,
        background: active ? `${ACCENT}14` : (hover ? '#F8FAFC' : 'transparent'),
        color: active ? ACCENT : (muted ? '#94A3B8' : '#1a1a1a'),
        fontSize: 13, fontWeight: active ? 600 : 400,
        fontFamily: 'inherit', textAlign: 'left',
        cursor: 'pointer', transition: 'background 0.1s ease',
      }}
    >
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {active && (
        <span style={{ color: ACCENT, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>✓</span>
      )}
    </button>
  )
}
