import { useState, useMemo } from 'react'
import { IconChevronLeft, IconChevronRight } from './Icons'

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// Build a 6x7 grid of dates starting from the Monday before (or on) the 1st of the month
function buildGrid(year, month) {
  const first = new Date(year, month, 1)
  // getDay: 0=Sun..6=Sat. We want Monday-first, so shift.
  const shift = (first.getDay() + 6) % 7
  const start = new Date(year, month, 1 - shift)
  const cells = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    cells.push(d)
  }
  return cells
}

export default function Calendar({ value, onChange, events = [], minDate, maxDate }) {
  const today = new Date()
  const selected = value ? new Date(value + 'T00:00:00') : null
  const [view, setView] = useState(() => {
    const base = selected || today
    return { year: base.getFullYear(), month: base.getMonth() }
  })

  const grid = useMemo(() => buildGrid(view.year, view.month), [view.year, view.month])

  // Index events by YMD
  const eventsByDay = useMemo(() => {
    const map = {}
    for (const ev of events) {
      const key = ev.event_date
      if (!key) continue
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    return map
  }, [events])

  const goPrev = () => setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })
  const goNext = () => setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })
  const goToday = () => {
    setView({ year: today.getFullYear(), month: today.getMonth() })
    onChange?.(ymd(today))
  }

  const min = minDate ? new Date(minDate + 'T00:00:00') : null
  const max = maxDate ? new Date(maxDate + 'T00:00:00') : null

  return (
    <div style={{ background: '#fff', border: '1px solid #E8ECF1', borderRadius: 14, padding: 14, userSelect: 'none' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
          {MONTHS[view.month]} <span style={{ color: '#94A3B8', fontWeight: 500 }}>{view.year}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={goToday}
            style={{
              background: 'transparent', border: '1px solid #E2E8F0', borderRadius: 8,
              padding: '4px 10px', fontSize: 11, fontWeight: 600, color: '#64748B',
              cursor: 'pointer', marginRight: 4,
            }}
          >Oggi</button>
          <NavBtn onClick={goPrev}><IconChevronLeft size={16} /></NavBtn>
          <NavBtn onClick={goNext}><IconChevronRight size={16} /></NavBtn>
        </div>
      </div>

      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 600, color: '#94A3B8', padding: '4px 0', letterSpacing: 0.3 }}>{w}</div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {grid.map((d, i) => {
          const inMonth = d.getMonth() === view.month
          const isToday = isSameDay(d, today)
          const isSelected = selected && isSameDay(d, selected)
          const disabled = (min && d < min) || (max && d > max)
          const dayEvents = eventsByDay[ymd(d)] || []
          const hasMilestone = dayEvents.some(e => e.is_milestone)
          const hasRegular = dayEvents.some(e => !e.is_milestone)

          return (
            <DayCell
              key={i}
              date={d}
              inMonth={inMonth}
              isToday={isToday}
              isSelected={isSelected}
              disabled={disabled}
              hasMilestone={hasMilestone}
              hasRegular={hasRegular}
              eventCount={dayEvents.length}
              onClick={() => !disabled && onChange?.(ymd(d))}
            />
          )
        })}
      </div>
    </div>
  )
}

function NavBtn({ children, onClick }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: h ? '#F1F5F9' : 'transparent', border: 'none', borderRadius: 8,
        color: '#64748B', cursor: 'pointer', transition: 'background 0.15s ease',
      }}
    >{children}</button>
  )
}

function DayCell({ date, inMonth, isToday, isSelected, disabled, hasMilestone, hasRegular, eventCount, onClick }) {
  const [h, setH] = useState(false)

  let bg = 'transparent'
  let color = inMonth ? '#1a1a1a' : '#CBD5E1'
  let borderColor = 'transparent'
  let fontWeight = 500

  if (isSelected) {
    bg = '#F28C28'
    color = '#fff'
    fontWeight = 700
  } else if (isToday) {
    bg = 'rgba(242,140,40,0.10)'
    color = '#F28C28'
    fontWeight = 700
  } else if (h && !disabled) {
    bg = '#F8FAFC'
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      disabled={disabled}
      style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        background: bg, border: `1px solid ${borderColor}`, borderRadius: 8,
        color, fontSize: 12, fontWeight,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.12s ease, color 0.12s ease',
        padding: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <span>{date.getDate()}</span>
      {/* Event dots */}
      {(hasMilestone || hasRegular) && (
        <span style={{
          position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: 2, alignItems: 'center',
        }}>
          {hasMilestone && (
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#fff' : '#F28C28' }} />
          )}
          {hasRegular && (
            <span style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.7)' : '#64748B' }} />
          )}
          {eventCount > 2 && (
            <span style={{ fontSize: 8, color: isSelected ? '#fff' : '#94A3B8', marginLeft: 1 }}>+</span>
          )}
        </span>
      )}
    </button>
  )
}
