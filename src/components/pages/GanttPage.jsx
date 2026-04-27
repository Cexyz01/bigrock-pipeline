import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { ACCENT, hasPermission } from '../../lib/constants'
import Btn from '../ui/Btn'
import Fade from '../ui/Fade'
import GanttItemModal from '../gantt/GanttItemModal'

// ── Date helpers (work with YYYY-MM-DD strings, no timezone surprises) ──
const MS_DAY = 86400000
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const daysBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / MS_DAY)

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const DAY_LABELS = ['D', 'L', 'M', 'M', 'G', 'V', 'S']

const ZOOMS = {
  week:  { dayW: 14, label: 'Settimana' },
  day:   { dayW: 28, label: 'Giorno' },
  hour:  { dayW: 56, label: 'Espanso' },
}

const LANE_W = 200
const ROW_H = 48
const HEADER_H = 64

export default function GanttPage({ items, currentProject, user, onCreate, onUpdate, onDelete, addToast }) {
  const canEdit = hasPermission(user, 'create_edit_tasks') || hasPermission(user, 'manage_project_settings')
  const [zoom, setZoom] = useState('day')
  const [editing, setEditing] = useState(null) // null | 'new' | itemObject
  const [drag, setDrag] = useState(null) // { id, mode, startX, origStart, origEnd }
  const [localItems, setLocalItems] = useState(items)

  useEffect(() => { setLocalItems(items) }, [items])

  const dayW = ZOOMS[zoom].dayW

  // Compute visible range: earliest start - 14 days .. latest end + 28 days, anchored on today
  const { rangeStart, rangeDays } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    let min = addDays(today, -14)
    let max = addDays(today, 56)
    for (const it of localItems) {
      const s = parseDate(it.start_date)
      const e = parseDate(it.end_date)
      if (s < min) min = s
      if (e > max) max = e
    }
    // Snap min to a Monday
    const dow = (min.getDay() + 6) % 7  // 0 = Mon, 6 = Sun
    const start = addDays(min, -dow - 7)
    const end = addDays(max, 14)
    return { rangeStart: start, rangeDays: daysBetween(start, end) + 1 }
  }, [localItems])

  // Group items into lanes; preserve insertion order, sort within by sort_order/start
  const lanes = useMemo(() => {
    const map = new Map()
    for (const it of localItems) {
      const key = it.lane || 'General'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(it)
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.sort_order - b.sort_order) || a.start_date.localeCompare(b.start_date))
    }
    if (map.size === 0) map.set('General', [])
    return Array.from(map.entries())
  }, [localItems])

  const totalW = rangeDays * dayW
  const totalH = lanes.length * ROW_H

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const todayX = daysBetween(rangeStart, today) * dayW

  // ── Drag/resize handling ──
  const scrollRef = useRef(null)
  const handlePointerDown = useCallback((e, item, mode) => {
    if (!canEdit) return
    e.preventDefault()
    e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    setDrag({
      id: item.id, mode,
      startX: e.clientX,
      origStart: item.start_date,
      origEnd: item.end_date,
    })
  }, [canEdit])

  const handlePointerMove = useCallback((e) => {
    if (!drag) return
    const deltaDays = Math.round((e.clientX - drag.startX) / dayW)
    if (deltaDays === 0) return
    setLocalItems(prev => prev.map(it => {
      if (it.id !== drag.id) return it
      const origS = parseDate(drag.origStart)
      const origE = parseDate(drag.origEnd)
      let newS = origS, newE = origE
      if (drag.mode === 'move')   { newS = addDays(origS, deltaDays); newE = addDays(origE, deltaDays) }
      if (drag.mode === 'resize-start') {
        newS = addDays(origS, deltaDays)
        if (newS > origE) newS = origE
      }
      if (drag.mode === 'resize-end') {
        newE = addDays(origE, deltaDays)
        if (newE < origS) newE = origS
      }
      return { ...it, start_date: toISO(newS), end_date: toISO(newE) }
    }))
  }, [drag, dayW])

  const handlePointerUp = useCallback(async () => {
    if (!drag) return
    const moved = localItems.find(it => it.id === drag.id)
    setDrag(null)
    if (moved && (moved.start_date !== drag.origStart || moved.end_date !== drag.origEnd)) {
      await onUpdate(drag.id, { start_date: moved.start_date, end_date: moved.end_date })
    }
  }, [drag, localItems, onUpdate])

  useEffect(() => {
    if (!drag) return
    const onMove = (e) => handlePointerMove(e)
    const onUp = () => handlePointerUp()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [drag, handlePointerMove, handlePointerUp])

  // Auto-scroll to today on mount / project change
  useEffect(() => {
    if (scrollRef.current) {
      const target = Math.max(0, todayX - 200)
      scrollRef.current.scrollLeft = target
    }
  }, [currentProject?.id])

  // ── Header: months + day numbers ──
  const headerCells = useMemo(() => {
    const days = []
    for (let i = 0; i < rangeDays; i++) {
      const d = addDays(rangeStart, i)
      days.push({ date: d, dow: d.getDay(), x: i * dayW })
    }
    // group by month
    const months = []
    let current = null
    for (const d of days) {
      const key = `${d.date.getFullYear()}-${d.date.getMonth()}`
      if (!current || current.key !== key) {
        current = { key, label: `${MONTH_LABELS[d.date.getMonth()]} ${d.date.getFullYear()}`, x: d.x, w: dayW }
        months.push(current)
      } else {
        current.w += dayW
      }
    }
    return { days, months }
  }, [rangeStart, rangeDays, dayW])

  const existingLanes = Array.from(new Set(localItems.map(it => it.lane || 'General')))

  const handleSave = async (payload) => {
    if (editing === 'new') {
      await onCreate({ ...payload, project_id: currentProject.id, created_by: user.id, sort_order: localItems.length })
    } else if (editing && editing.id) {
      await onUpdate(editing.id, payload)
    }
    setEditing(null)
  }

  const handleRemove = async () => {
    if (editing && editing.id) {
      await onDelete(editing.id)
      setEditing(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F0F2F5' }}>
      {/* Top bar */}
      <Fade>
        <div style={{ padding: '20px 28px 12px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' }}>Planning</h1>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>Diagramma di Gantt — pianificazione settimanale</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'inline-flex', background: '#fff', borderRadius: 999, padding: 3, gap: 2, border: '1px solid #E2E8F0' }}>
              {Object.entries(ZOOMS).map(([k, v]) => (
                <button key={k} onClick={() => setZoom(k)} style={{
                  padding: '5px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: zoom === k ? ACCENT : 'transparent',
                  color: zoom === k ? '#fff' : '#64748B',
                  transition: 'all 0.15s',
                }}>{v.label}</button>
              ))}
            </div>
            {canEdit && <Btn variant="primary" onClick={() => setEditing('new')}>+ Nuovo elemento</Btn>}
          </div>
        </div>
      </Fade>

      {/* Gantt body */}
      <div ref={scrollRef} style={{
        flex: 1, overflow: 'auto', margin: '0 28px 28px', borderRadius: 16,
        background: '#fff', border: '1px solid #E8ECF1', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        position: 'relative',
      }}>
        <div style={{ position: 'relative', minWidth: LANE_W + totalW, minHeight: HEADER_H + Math.max(totalH, 240) }}>
          {/* Lane column header (sticky top-left) */}
          <div style={{
            position: 'sticky', top: 0, left: 0, zIndex: 4,
            width: LANE_W, height: HEADER_H,
            background: '#fff', borderRight: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0',
            display: 'flex', alignItems: 'center', padding: '0 16px',
            fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>Lane</div>

          {/* Timeline header (sticky top) */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 3,
            marginLeft: LANE_W, height: HEADER_H, width: totalW,
            background: '#fff', borderBottom: '1px solid #E2E8F0',
          }}>
            {/* Months row */}
            <div style={{ position: 'relative', height: HEADER_H / 2, borderBottom: '1px solid #F1F5F9' }}>
              {headerCells.months.map(m => (
                <div key={m.key} style={{
                  position: 'absolute', left: m.x, width: m.w, height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                  paddingLeft: 8, fontSize: 12, fontWeight: 700, color: '#1a1a1a',
                  borderRight: '1px solid #F1F5F9',
                }}>{m.label}</div>
              ))}
            </div>
            {/* Days row */}
            <div style={{ position: 'relative', height: HEADER_H / 2 }}>
              {headerCells.days.map(d => {
                const isToday = +d.date === +today
                const isMonday = d.dow === 1
                const isWeekend = d.dow === 0 || d.dow === 6
                const showLabel = dayW >= 28 || isMonday
                return (
                  <div key={+d.date} style={{
                    position: 'absolute', left: d.x, width: dayW, height: '100%',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10,
                    color: isToday ? '#fff' : (isWeekend ? '#94A3B8' : '#64748B'),
                    background: isToday ? ACCENT : (isMonday ? '#F8FAFC' : 'transparent'),
                    borderRight: isMonday ? '1px solid #E2E8F0' : '1px solid #F8FAFC',
                    fontWeight: isToday ? 700 : 500,
                  }}>
                    {showLabel && (
                      <>
                        <span style={{ fontSize: 9, opacity: 0.7 }}>{DAY_LABELS[d.dow]}</span>
                        <span>{d.date.getDate()}</span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Lane rows */}
          <div style={{ position: 'relative' }}>
            {lanes.map(([laneName, laneItems], li) => (
              <div key={laneName} style={{
                position: 'absolute', top: HEADER_H + li * ROW_H, left: 0,
                width: LANE_W + totalW, height: ROW_H,
                borderBottom: '1px solid #F1F5F9',
                background: li % 2 === 0 ? '#FAFBFD' : '#fff',
              }}>
                {/* Lane label (sticky-ish via box) */}
                <div style={{
                  position: 'sticky', left: 0, zIndex: 2,
                  display: 'inline-flex', width: LANE_W, height: '100%',
                  alignItems: 'center', padding: '0 16px',
                  background: li % 2 === 0 ? '#FAFBFD' : '#fff',
                  borderRight: '1px solid #E2E8F0',
                  fontSize: 13, fontWeight: 600, color: '#1a1a1a',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  boxSizing: 'border-box',
                }}>{laneName}</div>
              </div>
            ))}

            {/* Day grid lines + weekend shading (in timeline area) */}
            <div style={{ position: 'absolute', top: HEADER_H, left: LANE_W, width: totalW, height: totalH, pointerEvents: 'none' }}>
              {headerCells.days.map(d => {
                const isWeekend = d.dow === 0 || d.dow === 6
                const isMonday = d.dow === 1
                if (!isWeekend && !isMonday) return null
                return (
                  <div key={+d.date} style={{
                    position: 'absolute', left: d.x, top: 0, width: dayW, height: '100%',
                    background: isWeekend ? 'rgba(148,163,184,0.06)' : 'transparent',
                    borderLeft: isMonday ? '1px solid #E2E8F0' : 'none',
                  }} />
                )
              })}
            </div>

            {/* Today vertical line */}
            {todayX >= 0 && todayX <= totalW && (
              <div style={{
                position: 'absolute', top: 0, left: LANE_W + todayX, width: 2,
                height: HEADER_H + totalH, background: ACCENT, opacity: 0.5,
                pointerEvents: 'none', zIndex: 1,
              }} />
            )}

            {/* Bars */}
            {lanes.map(([laneName, laneItems], li) => laneItems.map(item => {
              const s = parseDate(item.start_date)
              const e = parseDate(item.end_date)
              const x = LANE_W + daysBetween(rangeStart, s) * dayW
              const w = Math.max(dayW * 0.6, (daysBetween(s, e) + 1) * dayW - 4)
              const top = HEADER_H + li * ROW_H + 6
              const isDragging = drag?.id === item.id
              return (
                <div key={item.id}
                  onPointerDown={canEdit ? (ev) => handlePointerDown(ev, item, 'move') : undefined}
                  onClick={(ev) => { if (drag) return; ev.stopPropagation(); setEditing(item) }}
                  style={{
                    position: 'absolute', left: x, top, width: w, height: ROW_H - 12,
                    background: `linear-gradient(135deg, ${item.color} 0%, ${shade(item.color, -10)} 100%)`,
                    borderRadius: 8, cursor: canEdit ? (drag ? 'grabbing' : 'grab') : 'pointer',
                    boxShadow: isDragging ? `0 8px 24px ${item.color}66` : '0 1px 3px rgba(0,0,0,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '0 10px', color: '#fff', fontSize: 12, fontWeight: 600,
                    transition: isDragging ? 'none' : 'box-shadow 0.15s ease, transform 0.15s ease',
                    transform: isDragging ? 'translateY(-1px) scale(1.01)' : 'none',
                    userSelect: 'none', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}
                >
                  {/* Resize-left handle */}
                  {canEdit && w >= 28 && (
                    <div onPointerDown={(ev) => handlePointerDown(ev, item, 'resize-start')}
                      style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', background: 'rgba(255,255,255,0.0)' }} />
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingLeft: 4 }}>{item.title}</span>
                  <span style={{ fontSize: 10, opacity: 0.85, marginLeft: 8, flexShrink: 0 }}>
                    {daysBetween(s, e) + 1}g
                  </span>
                  {/* Resize-right handle */}
                  {canEdit && w >= 28 && (
                    <div onPointerDown={(ev) => handlePointerDown(ev, item, 'resize-end')}
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 8, cursor: 'ew-resize', background: 'rgba(255,255,255,0.0)' }} />
                  )}
                </div>
              )
            }))}
          </div>
        </div>
      </div>

      {/* Modal */}
      {editing && (
        <GanttItemModal
          open={!!editing}
          item={editing === 'new' ? null : editing}
          existingLanes={existingLanes}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          onDelete={editing !== 'new' ? handleRemove : null}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}

// Lighten/darken a hex color by percent (-100..100)
function shade(hex, percent) {
  if (!hex || !hex.startsWith('#')) return hex
  let h = hex.slice(1)
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (percent / 100) * 255)))
  r = f(r); g = f(g); b = f(b)
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}
