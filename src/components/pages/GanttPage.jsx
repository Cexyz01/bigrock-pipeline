import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { ACCENT, DEPTS, hasPermission } from '../../lib/constants'
import Btn from '../ui/Btn'
import Fade from '../ui/Fade'
import DateInput from '../ui/DateInput'
import { IconChevronDown } from '../ui/Icons'
import TaskDetailModal from '../tasks/TaskDetailModal'
import Modal from '../ui/Modal'

// ── Date helpers (work with YYYY-MM-DD strings, no timezone surprises) ──
const MS_DAY = 86400000
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const daysBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / MS_DAY)
const workingDays = (a, b, pauseSet) => {
  let n = 0; const cur = new Date(a)
  while (cur <= b) {
    const dow = cur.getDay()
    const iso = pauseSet ? toISO(cur) : null
    if (dow !== 0 && dow !== 6 && !(pauseSet && pauseSet.has(iso))) n++
    cur.setDate(cur.getDate() + 1)
  }
  return n
}

const MONTH_LABELS = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const DAY_LABELS = ['D', 'L', 'M', 'M', 'G', 'V', 'S']

const ZOOMS = {
  day:  { label: 'Giorno', weeks: 5 },
  zoom: { label: 'Zoom',   weeks: 2 },
}

const LANE_W = 220
const ROW_H = 40
const HEADER_H = 64
const PAUSE_DAY_W = 4 // compressed width for days inside a pause range
const MIN_PAUSE_RANGE_W = 30 // floor width for a whole pause range so the label can wrap onto 2 lines

export default function GanttPage({
  tasks = [], shots = [], assets = [], currentProject, user, profiles = [], projectMembers = [],
  pauses = [], onCreatePause, onDeletePause,
  onUpdateTask, onUpdateProjectDates, onGoToTask, addToast,
  onSetAssignees, onDeleteTask, onRejectTask, onAddWipComment,
  onCreateWipUpdate, onDeleteWipUpdate, onCommitForReview, onMarkWipViewed,
  wipViews, requestConfirm,
}) {
  const [showPauseManager, setShowPauseManager] = useState(false)
  const canEdit = hasPermission(user, 'create_edit_tasks') || hasPermission(user, 'manage_project_settings')
  const staff = hasPermission(user, 'create_edit_tasks')
  const [selectedTaskId, setSelectedTaskId] = useState(null)

  const [zoom, setZoom] = useState('day')
  const [groupBy, setGroupBy] = useState('dept') // 'dept' | 'entity'
  const [showAssets, setShowAssets] = useState(true)
  const [showShots, setShowShots] = useState(true)
  const [containerW, setContainerW] = useState(1200)
  const [drag, setDrag] = useState(null)
  const [localTasks, setLocalTasks] = useState(tasks)
  const [collapsed, setCollapsed] = useState(new Set()) // group ids that are collapsed
  // Multi-select: clicked bars, marquee box, and a quick helper to clear.
  // selectedIds = task IDs currently selected. marquee = { x0,y0,x1,y1,add }
  // in scroll-content coordinates while a box is being dragged on the body.
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [marquee, setMarquee] = useState(null)
  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])
  useEffect(() => { setLocalTasks(tasks) }, [tasks])

  // Tasks visible after the Asset/Shot toggles. Orphans (no shot or asset)
  // always show — the toggles only gate entity-bound tasks.
  const visibleTasks = useMemo(() => localTasks.filter(t => {
    if (t.asset_id) return showAssets
    if (t.shot_id) return showShots
    return true
  }), [localTasks, showAssets, showShots])

  // Visible date range: project window if set, otherwise auto-fit around scheduled tasks
  const { rangeStart, rangeDays } = useMemo(() => {
    if (currentProject?.start_date && currentProject?.end_date) {
      const s = parseDate(currentProject.start_date), e = parseDate(currentProject.end_date)
      return { rangeStart: s, rangeDays: Math.max(1, daysBetween(s, e) + 1) }
    }
    const today = new Date(); today.setHours(0, 0, 0, 0)
    let min = addDays(today, -14), max = addDays(today, 56)
    for (const t of localTasks) {
      if (!t.start_date) continue
      const s = parseDate(t.start_date)
      const e = addDays(s, (t.duration_days || 1) - 1)
      if (s < min) min = s; if (e > max) max = e
    }
    const dow = (min.getDay() + 6) % 7
    const start = addDays(min, -dow - 7)
    return { rangeStart: start, rangeDays: daysBetween(start, addDays(max, 14)) + 1 }
  }, [localTasks, currentProject?.start_date, currentProject?.end_date])

  // Build pause-day lookup (Set of YYYY-MM-DD strings inside any pause range)
  const pauseSet = useMemo(() => {
    const s = new Set()
    for (const p of pauses) {
      if (!p.start_date || !p.end_date) continue
      const a = parseDate(p.start_date), b = parseDate(p.end_date)
      const cur = new Date(a)
      while (cur <= b) { s.add(toISO(cur)); cur.setDate(cur.getDate() + 1) }
    }
    return s
  }, [pauses])

  // Walk visible days, find contiguous pause ranges, and reserve at least MIN_PAUSE_RANGE_W
  // for each so the rotated label has room to wrap onto 2 lines instead of being clipped.
  const pauseLayoutInfo = useMemo(() => {
    const perDayWByIdx = new Map()
    let totalPauseW = 0
    let curStart = -1, curLen = 0
    const flush = () => {
      if (curLen <= 0) return
      const totalW = Math.max(MIN_PAUSE_RANGE_W, curLen * PAUSE_DAY_W)
      const perDay = totalW / curLen
      for (let k = 0; k < curLen; k++) perDayWByIdx.set(curStart + k, perDay)
      totalPauseW += totalW
    }
    for (let i = 0; i < rangeDays; i++) {
      const iso = toISO(addDays(rangeStart, i))
      if (pauseSet.has(iso)) {
        if (curLen === 0) curStart = i
        curLen++
      } else {
        flush()
        curStart = -1; curLen = 0
      }
    }
    flush()
    return { perDayWByIdx, totalPauseW }
  }, [rangeStart, rangeDays, pauseSet])

  const dayW = Math.max(
    10,
    Math.floor((containerW - LANE_W - pauseLayoutInfo.totalPauseW) / Math.max(1, (ZOOMS[zoom]?.weeks || 5) * 7))
  )

  // Per-day layout: x and w for every day in the visible range.
  // Pause days share their range's reserved width; non-pause days use dayW.
  const dayLayout = useMemo(() => {
    const arr = new Array(rangeDays)
    let x = 0
    for (let i = 0; i < rangeDays; i++) {
      const date = addDays(rangeStart, i)
      const iso = toISO(date)
      const isPause = pauseSet.has(iso)
      const w = isPause ? (pauseLayoutInfo.perDayWByIdx.get(i) || PAUSE_DAY_W) : dayW
      arr[i] = { date, dow: date.getDay(), x, w, isPause, iso }
      x += w
    }
    return arr
  }, [rangeStart, rangeDays, dayW, pauseSet, pauseLayoutInfo])

  const totalW = useMemo(() => dayLayout.length ? (dayLayout[dayLayout.length - 1].x + dayLayout[dayLayout.length - 1].w) : 0, [dayLayout])

  // x of the LEFT edge of a given date; clamped if outside the visible range.
  const dateToX = useCallback((d) => {
    const idx = daysBetween(rangeStart, d)
    if (idx < 0) return 0
    if (idx >= dayLayout.length) return totalW
    return dayLayout[idx].x
  }, [rangeStart, dayLayout, totalW])
  // x of the RIGHT edge of a given date (i.e. x + w).
  const dateToEndX = useCallback((d) => {
    const idx = daysBetween(rangeStart, d)
    if (idx < 0) return 0
    if (idx >= dayLayout.length) return totalW
    return dayLayout[idx].x + dayLayout[idx].w
  }, [rangeStart, dayLayout, totalW])

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])
  const todayX = dateToX(today)

  // Render-friendly per-pause ranges (one band per pause record, with its label).
  const pauseRanges = useMemo(() => {
    return pauses
      .filter(p => p.start_date && p.end_date)
      .map(p => {
        const s = parseDate(p.start_date)
        const e = parseDate(p.end_date)
        const x = dateToX(s)
        const w = dateToEndX(e) - x
        const days = daysBetween(s, e) + 1
        return { id: p.id, x, w, days, label: p.label || 'Pausa', start: p.start_date, end: p.end_date }
      })
      .filter(r => r.w > 0)
  }, [pauses, dateToX, dateToEndX])

  // Position of each shot/asset in the canonical (Shot Tracker) page order, so tasks
  // that share start_date fall in the same vertical order users see elsewhere.
  const shotOrderMap = useMemo(() => {
    const sorted = [...(shots || [])].sort((a, b) =>
      (a.sequence || '').localeCompare(b.sequence || '') ||
      ((a.sort_order ?? 0) - (b.sort_order ?? 0)) ||
      (a.code || '').localeCompare(b.code || '')
    )
    const m = {}
    sorted.forEach((s, i) => { m[s.id] = i })
    return m
  }, [shots])
  const assetOrderMap = useMemo(() => {
    const sorted = [...(assets || [])].sort((a, b) =>
      ((a.sort_order ?? 0) - (b.sort_order ?? 0)) ||
      (a.name || '').localeCompare(b.name || '')
    )
    const m = {}
    sorted.forEach((a, i) => { m[a.id] = i })
    return m
  }, [assets])

  // Bucket index: assets render above shots above orphans, regardless of date.
  const entityBucket = (t) => t.asset_id ? 0 : (t.shot_id ? 1 : 2)
  const entityOrder = useCallback((t) => {
    if (t.asset_id && assetOrderMap[t.asset_id] !== undefined) return assetOrderMap[t.asset_id]
    if (t.shot_id && shotOrderMap[t.shot_id] !== undefined) return shotOrderMap[t.shot_id]
    return Number.MAX_SAFE_INTEGER
  }, [shotOrderMap, assetOrderMap])

  // Stable vertical ordering: capture once per project so tasks don't snap to a new
  // row mid-drag when their start_date changes. Hard separation: all asset-bound tasks
  // first (in canonical asset order), then all shot-bound tasks (in canonical shot
  // order), then orphans. Tasks of the same entity cascade by their own start_date.
  const orderRef = useRef(null)
  const projectKey = currentProject?.id || 'none'
  if (!orderRef.current || orderRef.current.projectKey !== projectKey) {
    const validTasks = tasks.filter(t => t.department && t.start_date && t.duration_days)
    const sorted = [...validTasks].sort((a, b) => {
      // 1. Asset tasks above shot tasks above orphans
      const ba = entityBucket(a), bb = entityBucket(b)
      if (ba !== bb) return ba - bb
      // 2. Canonical entity order within the bucket
      const ea = entityOrder(a), eb = entityOrder(b)
      if (ea !== eb) return ea - eb
      // 3. Within the same entity, cascade by start_date then title
      return (a.start_date || '').localeCompare(b.start_date || '') ||
             (a.title || '').localeCompare(b.title || '')
    })
    const indexById = {}
    sorted.forEach((t, i) => { indexById[t.id] = i })
    orderRef.current = { projectKey, indexById }
  }

  // Group scheduled tasks by department; lanes are fixed = DEPTS in canonical order.
  const taskLookup = useMemo(() => {
    const m = {}; for (const t of localTasks) m[t.id] = t; return m
  }, [localTasks])
  const tasksByDept = useMemo(() => {
    const m = {}
    for (const d of DEPTS) m[d.id] = []
    for (const t of visibleTasks) {
      if (!t.department || !t.start_date || !t.duration_days) continue
      if (!m[t.department]) m[t.department] = []
      m[t.department].push(t)
    }
    const idx = orderRef.current?.indexById || {}
    for (const arr of Object.values(m)) {
      arr.sort((a, b) => {
        const ia = idx[a.id] ?? Infinity
        const ib = idx[b.id] ?? Infinity
        if (ia !== ib) return ia - ib
        return (a.start_date || '').localeCompare(b.start_date || '') || (a.title || '').localeCompare(b.title || '')
      })
    }
    return m
  }, [visibleTasks, projectKey])

  // Lookup of department definitions by id (for color/label of task bars in entity mode)
  const deptById = useMemo(() => {
    const m = {}; for (const d of DEPTS) m[d.id] = d; return m
  }, [])

  // Build lane groups for the current groupBy mode.
  // Each group: { id, label, color, tasks[] } — id used for collapse state and react keys.
  const groups = useMemo(() => {
    if (groupBy === 'dept') {
      return DEPTS.map(d => ({
        id: `dept-${d.id}`,
        label: d.label,
        color: d.color,
        kind: 'dept',
        dept: d,
        tasks: tasksByDept[d.id] || [],
      }))
    }
    // Entity mode: one lane per shot/asset, tasks inside cascade by start_date.
    // Tasks keep their dept color (computed at render time from t.department).
    const byShot = new Map()
    const byAsset = new Map()
    const orphanTasks = []
    for (const t of visibleTasks) {
      if (!t.department || !t.start_date || !t.duration_days) continue
      if (t.shot_id) {
        if (!byShot.has(t.shot_id)) byShot.set(t.shot_id, [])
        byShot.get(t.shot_id).push(t)
      } else if (t.asset_id) {
        if (!byAsset.has(t.asset_id)) byAsset.set(t.asset_id, [])
        byAsset.get(t.asset_id).push(t)
      } else {
        orphanTasks.push(t)
      }
    }
    const sortByDate = (a, b) => (a.start_date || '').localeCompare(b.start_date || '') ||
      (a.title || '').localeCompare(b.title || '')
    for (const arr of byShot.values()) arr.sort(sortByDate)
    for (const arr of byAsset.values()) arr.sort(sortByDate)
    orphanTasks.sort(sortByDate)
    // Walk shots in canonical Shot Tracker order, then assets in their order.
    const sortedShots = [...(shots || [])].sort((a, b) =>
      (a.sequence || '').localeCompare(b.sequence || '') ||
      ((a.sort_order ?? 0) - (b.sort_order ?? 0)) ||
      (a.code || '').localeCompare(b.code || '')
    )
    const sortedAssets = [...(assets || [])].sort((a, b) =>
      ((a.sort_order ?? 0) - (b.sort_order ?? 0)) ||
      (a.name || '').localeCompare(b.name || '')
    )
    const out = []
    for (const a of sortedAssets) {
      const arr = byAsset.get(a.id)
      if (!arr || !arr.length) continue
      out.push({
        id: `asset-${a.id}`,
        label: a.name,
        color: '#7C3AED',
        kind: 'asset',
        asset: a,
        tasks: arr,
      })
    }
    for (const s of sortedShots) {
      const arr = byShot.get(s.id)
      if (!arr || !arr.length) continue
      out.push({
        id: `shot-${s.id}`,
        label: s.code,
        color: '#64748B',
        kind: 'shot',
        shot: s,
        tasks: arr,
      })
    }
    if (orphanTasks.length) {
      out.push({
        id: 'orphan',
        label: 'Senza shot/asset',
        color: '#94A3B8',
        kind: 'orphan',
        tasks: orphanTasks,
      })
    }
    return out
  }, [groupBy, visibleTasks, tasksByDept, shots, assets])

  // Flatten visible rows: each lane is 1 header row + N task rows when expanded.
  const rows = useMemo(() => {
    const out = []
    for (const g of groups) {
      out.push({ kind: 'lane', group: g, count: g.tasks.length })
      if (!collapsed.has(g.id)) {
        for (const t of g.tasks) out.push({ kind: 'task', group: g, task: t })
      }
    }
    return out
  }, [groups, collapsed])

  const totalH = rows.length * ROW_H

  // Bar geometries in scroll-content coordinates — used by the marquee
  // selection to figure out which bars the user is brushing over without
  // touching the DOM. Mirrors the render math below; keep them in sync.
  const taskBoxes = useMemo(() => {
    const out = []
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri]
      if (row.kind !== 'task') continue
      const t = row.task
      if (!t.start_date || !t.duration_days) continue
      const s = parseDate(t.start_date)
      const e = addDays(s, (t.duration_days || 1) - 1)
      const barLeftX = dateToX(s)
      const barRightX = dateToEndX(e)
      const x = LANE_W + barLeftX + 4
      const w = Math.max(6, barRightX - barLeftX - 8)
      const top = HEADER_H + ri * ROW_H + 6
      out.push({ id: t.id, left: x, right: x + w, top, bottom: top + ROW_H - 12 })
    }
    return out
  }, [rows, dateToX, dateToEndX])

  // ── Drag/resize ──
  const scrollRef = useRef(null)
  // bodyRef points to the inner "body rows" wrapper. Marquee coordinates are
  // computed relative to this element so they line up with the bar positions
  // (which use the body-wrapper's own coordinate system, not the outer one).
  const bodyRef = useRef(null)
  const dragMovedRef = useRef(false)
  const lastDeltaRef = useRef(0)

  useEffect(() => {
    if (!scrollRef.current) return
    const el = scrollRef.current
    const update = () => setContainerW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Auto-scroll to today on project change
  useEffect(() => {
    if (scrollRef.current) {
      const target = Math.max(0, todayX - 200)
      scrollRef.current.scrollLeft = target
    }
  }, [currentProject?.id])

  const handlePointerDown = useCallback((e, task, mode) => {
    if (!canEdit) return
    e.preventDefault(); e.stopPropagation()
    e.target.setPointerCapture?.(e.pointerId)
    dragMovedRef.current = false
    lastDeltaRef.current = 0
    // If the bar the user grabbed is part of the current selection (and there
    // is more than one selected), drag every selected task together. Otherwise
    // drag only this bar — selection is unaffected until the click handler
    // resolves below (so a simple drag on an unselected bar doesn't reset
    // an existing multi-selection until the user lets go).
    const dragMulti = selectedIds.has(task.id) && selectedIds.size > 1
    const itemTasks = dragMulti
      ? localTasks.filter(t => selectedIds.has(t.id) && t.start_date && t.duration_days)
      : [task]
    const items = itemTasks.map(t => ({
      id: t.id, origStart: t.start_date, origDuration: t.duration_days,
    }))
    setDrag({ leadId: task.id, mode, startX: e.clientX, items })
  }, [canEdit, selectedIds, localTasks])

  const handlePointerMove = useCallback((e) => {
    if (!drag) return
    const deltaDays = Math.round((e.clientX - drag.startX) / dayW)
    if (Math.abs(e.clientX - drag.startX) > 3) dragMovedRef.current = true
    if (deltaDays === lastDeltaRef.current) return
    lastDeltaRef.current = deltaDays
    const byId = new Map(drag.items.map(it => [it.id, it]))
    setLocalTasks(prev => prev.map(t => {
      const it = byId.get(t.id)
      if (!it) return t
      const origS = parseDate(it.origStart)
      let newStart = it.origStart
      let newDuration = it.origDuration
      if (drag.mode === 'move') {
        newStart = toISO(addDays(origS, deltaDays))
      } else if (drag.mode === 'resize-start') {
        const shifted = addDays(origS, deltaDays)
        const end = addDays(origS, it.origDuration - 1)
        if (shifted > end) newStart = toISO(end)
        else newStart = toISO(shifted)
        newDuration = Math.max(1, it.origDuration - deltaDays)
      } else if (drag.mode === 'resize-end') {
        newDuration = Math.max(1, it.origDuration + deltaDays)
      }
      return { ...t, start_date: newStart, duration_days: newDuration }
    }))
  }, [drag, dayW])

  const handlePointerUp = useCallback(async () => {
    if (!drag) return
    const items = drag.items
    setDrag(null)
    const fresh = new Map(localTasks.map(t => [t.id, t]))
    const writes = []
    for (const it of items) {
      const t = fresh.get(it.id)
      if (!t) continue
      const updates = {}
      if (t.start_date !== it.origStart) updates.start_date = t.start_date
      if (t.duration_days !== it.origDuration) updates.duration_days = t.duration_days
      if (Object.keys(updates).length > 0) writes.push(onUpdateTask(it.id, updates))
    }
    if (writes.length > 0) await Promise.all(writes)
  }, [drag, localTasks, onUpdateTask])

  useEffect(() => {
    if (!drag) return
    const onMove = (e) => handlePointerMove(e)
    const onUp = () => handlePointerUp()
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [drag, handlePointerMove, handlePointerUp])

  // ── Marquee box selection ──
  // Mousedown on the gantt body (but NOT on a bar/lane header) starts a
  // drag-box. While dragging, selectedIds is recomputed from taskBoxes that
  // intersect the box. A plain (no-shift) click in empty space simply clears
  // the selection — same as clicking somewhere harmless.
  const startMarquee = useCallback((e) => {
    if (!canEdit) return
    if (e.button !== 0) return
    if (e.target.closest && e.target.closest('[data-task-bar], [data-lane-header]')) return
    if (drag) return
    e.preventDefault()
    const bw = bodyRef.current
    if (!bw) return
    // bodyRef's getBoundingClientRect().top already factors in scroll AND any
    // header rows above it, so coordinates here line up 1:1 with the
    // body-wrapper-relative coords used by taskBoxes and bar rendering.
    const rect = bw.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    setMarquee({ x0: cx, y0: cy, x1: cx, y1: cy, add: e.shiftKey, baseSelection: e.shiftKey ? new Set(selectedIds) : new Set() })
    if (!e.shiftKey) setSelectedIds(new Set())
  }, [canEdit, drag, selectedIds])

  useEffect(() => {
    if (!marquee) return
    const bw = bodyRef.current
    if (!bw) return
    const onMove = (e) => {
      const rect = bw.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const minX = Math.min(marquee.x0, cx), maxX = Math.max(marquee.x0, cx)
      const minY = Math.min(marquee.y0, cy), maxY = Math.max(marquee.y0, cy)
      const hits = new Set(marquee.baseSelection)
      for (const b of taskBoxes) {
        if (b.left < maxX && b.right > minX && b.top < maxY && b.bottom > minY) hits.add(b.id)
      }
      setMarquee(m => m ? { ...m, x1: cx, y1: cy } : null)
      setSelectedIds(hits)
    }
    const onUp = () => setMarquee(null)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [marquee, taskBoxes])

  // Esc clears the current selection. Doesn't intercept anything else.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && selectedIds.size > 0) setSelectedIds(new Set()) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedIds.size])

  // ── Header months/days/weeks ──
  // Uses dayLayout so pause days collapse along with the rest of the timeline.
  const headerCells = useMemo(() => {
    const days = dayLayout
    const months = []
    let curM = null
    for (const d of days) {
      const key = `${d.date.getFullYear()}-${d.date.getMonth()}`
      if (!curM || curM.key !== key) {
        curM = { key, label: `${MONTH_LABELS[d.date.getMonth()]} ${d.date.getFullYear()}`, x: d.x, w: d.w }
        months.push(curM)
      } else curM.w += d.w
    }
    const weeks = []
    let curW = null, weekNum = 0
    for (const d of days) {
      const isMonday = d.dow === 1
      if (!curW || isMonday) { weekNum++; curW = { num: weekNum, x: d.x, w: d.w }; weeks.push(curW) }
      else curW.w += d.w
    }
    // Contiguous pause spans (for the grey overlay band on the timeline body)
    const pauseSpans = []
    let curP = null
    for (const d of days) {
      if (d.isPause) {
        if (!curP) { curP = { x: d.x, w: d.w }; pauseSpans.push(curP) }
        else curP.w += d.w
      } else {
        curP = null
      }
    }
    return { days, months, weeks, pauseSpans }
  }, [dayLayout])

  const toggleLane = (groupId) => setCollapsed(prev => {
    const next = new Set(prev)
    if (next.has(groupId)) next.delete(groupId); else next.add(groupId)
    return next
  })

  const expandAll = () => setCollapsed(new Set())
  const collapseAll = () => setCollapsed(new Set(groups.map(g => g.id)))

  // Default to fully collapsed on first load and whenever the project or groupBy mode
  // changes — the expanded view gets unwieldy fast, the user can open what they want.
  const initCollapseRef = useRef('')
  const initKey = `${projectKey}|${groupBy}`
  if (initCollapseRef.current !== initKey && groups.length > 0) {
    initCollapseRef.current = initKey
    // Schedule out of render to avoid setting state during render
    queueMicrotask(() => setCollapsed(new Set(groups.map(g => g.id))))
  }

  // Count of unscheduled tasks (have a department but no start_date / duration).
  // Respects the Asset/Shot filters so the badge matches what the user is looking at.
  const unscheduledCount = visibleTasks.filter(t => t.department && (!t.start_date || !t.duration_days)).length

  // Project-filtered + project_role-enriched students for the AssigneePicker
  // shown inside TaskDetailModal. Same shape as TasksPage.
  const students = useMemo(() => {
    const memberByUser = new Map((projectMembers || []).map(m => [m.user_id, m]))
    return (profiles || [])
      .filter(p => p.role === 'studente' && memberByUser.has(p.id))
      .map(s => {
        const m = memberByUser.get(s.id)
        return { ...s, department: m.project_role || s.department || null }
      })
  }, [profiles, projectMembers])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F0F2F5' }}>
      {/* Top bar */}
      <Fade>
        <div style={{ padding: '20px 28px 12px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' }}>Planning</h1>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
              Diagramma di Gantt dei task per dipartimento
              {unscheduledCount > 0 && <span style={{ marginLeft: 10, color: '#F59E0B', fontWeight: 600 }}>· {unscheduledCount} task senza pianificazione</span>}
            </p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {canEdit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: 999 }}>
                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>Progetto:</span>
                <DateInput value={currentProject?.start_date || ''}
                  onChange={v => onUpdateProjectDates(v, currentProject?.end_date || '')}
                  compact placeholder="—" showIcon={false}
                  inputStyle={{ border: 'none', background: 'transparent', padding: '2px 4px', boxShadow: 'none' }}
                  style={{ width: 110 }} />
                <span style={{ fontSize: 11, color: '#94A3B8' }}>→</span>
                <DateInput value={currentProject?.end_date || ''}
                  minDate={currentProject?.start_date || undefined}
                  onChange={v => onUpdateProjectDates(currentProject?.start_date || '', v)}
                  compact placeholder="—" showIcon={false}
                  inputStyle={{ border: 'none', background: 'transparent', padding: '2px 4px', boxShadow: 'none' }}
                  style={{ width: 110 }} />
              </div>
            )}
            <div style={{ display: 'inline-flex', background: '#fff', borderRadius: 999, padding: 3, gap: 2, border: '1px solid #E2E8F0' }}>
              {[
                { k: 'dept',   label: 'Dipartimento' },
                { k: 'entity', label: 'Shot / Asset' },
              ].map(({ k, label }) => (
                <button key={k} onClick={() => { setGroupBy(k); setCollapsed(new Set()) }} style={{
                  padding: '5px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: groupBy === k ? ACCENT : 'transparent',
                  color: groupBy === k ? '#fff' : '#64748B', transition: 'all 0.15s',
                }}>{label}</button>
              ))}
            </div>
            {/* Entity filter — assets render above shots, each toggle hides its kind */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '5px 12px', background: '#fff', borderRadius: 999, border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>Mostra:</span>
              {[
                { k: 'asset', label: 'Asset', checked: showAssets, setter: setShowAssets },
                { k: 'shot',  label: 'Shot',  checked: showShots,  setter: setShowShots },
              ].map(({ k, label, checked, setter }) => (
                <label key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: checked ? '#1a1a1a' : '#94A3B8', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={checked} onChange={e => setter(e.target.checked)}
                    style={{ width: 14, height: 14, accentColor: ACCENT, cursor: 'pointer', margin: 0 }} />
                  {label}
                </label>
              ))}
            </div>
            <div style={{ display: 'inline-flex', background: '#fff', borderRadius: 999, padding: 3, gap: 2, border: '1px solid #E2E8F0' }}>
              {Object.entries(ZOOMS).map(([k, v]) => (
                <button key={k} onClick={() => setZoom(k)} style={{
                  padding: '5px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: zoom === k ? ACCENT : 'transparent',
                  color: zoom === k ? '#fff' : '#64748B', transition: 'all 0.15s',
                }}>{v.label}</button>
              ))}
            </div>
            {canEdit && (
              <Btn variant="info" onClick={() => setShowPauseManager(true)}>
                Pause {pauses.length > 0 ? `(${pauses.length})` : ''}
              </Btn>
            )}
            <Btn variant="info" onClick={collapsed.size >= groups.length ? expandAll : collapseAll}>
              {collapsed.size >= groups.length ? 'Espandi tutto' : 'Comprimi tutto'}
            </Btn>
            {selectedIds.size > 0 && (
              <button onClick={clearSelection} title="Deseleziona (Esc)"
                style={{
                  padding: '5px 12px', borderRadius: 999, border: `1.5px solid ${ACCENT}`,
                  background: `${ACCENT}18`, color: ACCENT, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                {selectedIds.size} selezionati <span style={{ opacity: 0.6 }}>· ✕</span>
              </button>
            )}
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
          {/* Lane column corner */}
          <div style={{
            position: 'sticky', top: 0, left: 0, zIndex: 4,
            width: LANE_W, height: HEADER_H, background: '#fff',
          }} />

          {/* Timeline header */}
          <div style={{
            position: 'sticky', top: 0, zIndex: 3,
            marginLeft: LANE_W, height: HEADER_H, width: totalW,
            background: '#fff', borderBottom: '1px solid #E2E8F0',
          }}>
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
            <div style={{ position: 'relative', height: HEADER_H / 2 }}>
              {headerCells.days.map(d => {
                  if (d.isPause) return null // covered by the dedicated pause band below
                  const isToday = +d.date === +today
                  const isMonday = d.dow === 1
                  const isWeekend = d.dow === 0 || d.dow === 6
                  return (
                    <div key={+d.date} style={{
                      position: 'absolute', left: d.x, width: d.w, height: '100%',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10,
                      color: isToday ? '#fff' : (isWeekend ? '#94A3B8' : '#64748B'),
                      background: isToday ? ACCENT : (isMonday ? '#F8FAFC' : 'transparent'),
                      borderRight: isMonday ? '1px solid #E2E8F0' : '1px solid #F8FAFC',
                      fontWeight: isToday ? 700 : 500,
                    }}>
                      <span style={{ fontSize: 9, opacity: 0.7 }}>{DAY_LABELS[d.dow]}</span>
                      <span>{d.date.getDate()}</span>
                    </div>
                  )
                })}
            </div>
            {/* Pause bands in the header — span full HEADER_H so they cover both month + day rows */}
            {pauseRanges.map(p => (
              <div key={`hdr-pause-${p.id}`} title={`${p.label} · ${p.start} → ${p.end} (${p.days} giorni)`}
                style={{
                  position: 'absolute', left: p.x, top: 0, width: p.w, height: HEADER_H,
                  background: 'linear-gradient(180deg, #FEF3C7 0%, #FDE68A 100%)',
                  borderLeft: '1.5px dashed #F59E0B',
                  borderRight: '1.5px dashed #F59E0B',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', boxSizing: 'border-box',
                }}>
                <div style={{
                  writingMode: 'vertical-rl', transform: 'rotate(180deg)',
                  fontSize: p.w >= 32 ? 10 : 9, fontWeight: 700, color: '#92400E',
                  letterSpacing: 1.0, textTransform: 'uppercase',
                  whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center',
                  lineHeight: 1.1, maxHeight: HEADER_H - 8,
                }}>
                  {p.label}
                </div>
              </div>
            ))}
          </div>

          {/* Body rows */}
          <div ref={bodyRef} onMouseDown={startMarquee} style={{ position: 'relative' }}>
            {rows.map((row, ri) => {
              const top = HEADER_H + ri * ROW_H
              if (row.kind === 'lane') {
                const g = row.group
                const isCollapsed = collapsed.has(g.id)
                const laneTasks = g.tasks
                // Aggregate bar: span from earliest start to latest end across this lane's tasks.
                let agg = null
                if (laneTasks.length > 0) {
                  let minS = parseDate(laneTasks[0].start_date)
                  let maxE = addDays(minS, (laneTasks[0].duration_days || 1) - 1)
                  for (const lt of laneTasks) {
                    const s2 = parseDate(lt.start_date)
                    const e2 = addDays(s2, (lt.duration_days || 1) - 1)
                    if (s2 < minS) minS = s2
                    if (e2 > maxE) maxE = e2
                  }
                  const ax = LANE_W + dateToX(minS) + 4
                  const aw = Math.max(dayW * 0.6, dateToEndX(maxE) - dateToX(minS) - 8)
                  agg = { x: ax, w: aw, days: workingDays(minS, maxE, pauseSet) }
                }
                return (
                  <div key={`lane-${g.id}`} style={{
                    position: 'absolute', top, left: 0, width: LANE_W + totalW, height: ROW_H,
                    borderBottom: '1px solid #E8ECF1',
                    background: `${g.color}10`,
                  }}>
                    {/* Aggregate bar — keep the saturated dept palette in Dipartimento view,
                        only desaturate in Shot/Asset view where the lane colors (deep purple, near-black)
                        were too harsh. */}
                    {agg && (() => {
                      const isEntity = groupBy === 'entity'
                      const c1 = isEntity ? desaturate(g.color, 0.45) : g.color
                      const c2 = isEntity ? desaturate(shade(g.color, -18), 0.45) : shade(g.color, -18)
                      const cBorder = isEntity ? desaturate(shade(g.color, -25), 0.45) : shade(g.color, -25)
                      return (
                        <div title={`Span totale ${g.label}: ${agg.days}g lavorativi`} style={{
                          position: 'absolute', left: agg.x, top: 8, width: agg.w, height: ROW_H - 16,
                          background: `repeating-linear-gradient(135deg, ${c1} 0 8px, ${c2} 8px 16px)`,
                          opacity: isEntity ? 0.85 : 1,
                          borderRadius: 6, border: `1.5px solid ${cBorder}`,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                          pointerEvents: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                          padding: '0 10px', color: '#fff', fontSize: 10, fontWeight: 700,
                          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                        }}>{agg.days}g</div>
                      )
                    })()}
                    {/* Sticky lane header */}
                    <div data-lane-header="1" style={{
                      position: 'sticky', left: 0, zIndex: 3,
                      display: 'inline-flex', width: LANE_W, height: '100%',
                      alignItems: 'center', padding: '0 12px', gap: 10,
                      background: `linear-gradient(${g.color}10, ${g.color}10), #fff`,
                      borderRight: `2px solid ${g.color}`,
                      cursor: 'pointer', boxSizing: 'border-box',
                    }}
                      onClick={() => toggleLane(g.id)}
                    >
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: 6, background: 'rgba(255,255,255,0.6)',
                        transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s ease',
                        color: g.color,
                      }}><IconChevronDown size={14} /></span>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: g.color,
                        padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.7)',
                      }}>{row.count}</span>
                    </div>
                  </div>
                )
              }
              // Task row — bar color always reflects the task's department,
              // regardless of how the lanes are grouped.
              const g = row.group
              const taskDept = deptById[row.task.department] || { color: '#94A3B8', label: row.task.department }
              const t = row.task
              const s = parseDate(t.start_date)
              const e = addDays(s, (t.duration_days || 1) - 1)
              const barLeftX = dateToX(s)
              const barRightX = dateToEndX(e)
              const x = LANE_W + barLeftX + 4
              const w = Math.max(6, barRightX - barLeftX - 8)
              const isDragging = drag?.id === t.id
              const rowBg = ri % 2 === 0 ? '#FAFBFD' : '#fff'
              const assigneeCount = (t.assignees || []).length
              const requiredCount = t.required_assignees || 1
              const isUnassigned = assigneeCount < requiredCount
              // Display label: "Asset: Title" or "ShotCode: Title", fallback to just title
              const containerLabel = t.asset?.name || t.shot?.code || ''
              const fullLabel = containerLabel ? `${containerLabel}: ${t.title}` : t.title
              return (
                <div key={`task-${t.id}`} style={{
                  position: 'absolute', top, left: 0, width: LANE_W + totalW, height: ROW_H,
                  borderBottom: '1px solid #F1F5F9', background: rowBg,
                }}>
                  {/* Sticky task name */}
                  <div data-lane-header="1" style={{
                    position: 'sticky', left: 0, zIndex: 2,
                    display: 'inline-flex', width: LANE_W, height: '100%',
                    alignItems: 'center', padding: '0 12px 0 36px', gap: 8,
                    background: rowBg, borderRight: `2px solid ${g.color}`,
                    boxSizing: 'border-box',
                  }} title={`${fullLabel} · ${taskDept.label}`}>
                    {/* Department tab — always shows the dept color so a dimmed (unassigned)
                        task is still recognisable at a glance, especially in Shot/Asset view. */}
                    <span style={{
                      position: 'absolute', left: 22, top: 8, bottom: 8, width: 4,
                      borderRadius: 2, background: taskDept.color,
                    }} />
                    <span style={{
                      fontSize: 12, color: '#1a1a1a', flex: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{fullLabel}</span>
                  </div>
                  {/* Bar */}
                  <div
                    data-task-bar={t.id}
                    onPointerDown={canEdit ? (ev) => handlePointerDown(ev, t, 'move') : undefined}
                    onClick={(ev) => {
                      if (dragMovedRef.current) { ev.stopPropagation(); dragMovedRef.current = false; return }
                      // Click without drag = (de)select. Shift toggles, plain
                      // click selects only this bar (but keeps the existing
                      // selection if the bar was already part of it — letting
                      // the user grab a multi-selection without losing it).
                      ev.stopPropagation()
                      if (ev.shiftKey) {
                        setSelectedIds(prev => {
                          const next = new Set(prev)
                          if (next.has(t.id)) next.delete(t.id); else next.add(t.id)
                          return next
                        })
                      } else if (!selectedIds.has(t.id)) {
                        setSelectedIds(new Set([t.id]))
                      }
                    }}
                    onDoubleClick={(ev) => { ev.stopPropagation(); setSelectedTaskId(t.id) }}
                    style={(() => {
                      // Completed tasks (status === 'approved') are painted
                      // solid green with reduced opacity so they recede a bit
                      // visually while staying unmistakably "done".
                      const isDone = t.status === 'approved'
                      const isSel = selectedIds.has(t.id)
                      const selRing = isSel ? `0 0 0 2px ${ACCENT}` : ''
                      const ambient = isDragging
                        ? `0 8px 24px ${taskDept.color}66`
                        : '0 1px 3px rgba(0,0,0,0.12)'
                      const selGlow = isSel ? `0 4px 14px ${ACCENT}55` : ''
                      const shadow = [selRing, selGlow, ambient].filter(Boolean).join(', ')
                      const bg = isDone
                        ? `linear-gradient(135deg, #10B981 0%, #059669 100%)`
                        : (isUnassigned
                          ? `linear-gradient(135deg, #CBD5E1 0%, #94A3B8 100%)`
                          : `linear-gradient(135deg, ${taskDept.color} 0%, ${shade(taskDept.color, -10)} 100%)`)
                      const op = isDone ? 0.55 : (isUnassigned ? 0.55 : 1)
                      return {
                      position: 'absolute', left: x, top: 6, width: w, height: ROW_H - 12,
                      background: bg,
                      opacity: op,
                      borderRadius: 8, cursor: canEdit ? (drag ? 'grabbing' : 'grab') : 'pointer',
                      boxShadow: shadow,
                      outline: isSel ? `1px solid ${ACCENT}` : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: w < 50 ? '0 4px' : '0 10px', color: '#fff', fontSize: 12, fontWeight: 600,
                      transition: isDragging ? 'none' : 'box-shadow 0.15s ease, transform 0.15s ease',
                      transform: isDragging ? 'translateY(-1px) scale(1.01)' : 'none',
                      userSelect: 'none', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      } })()}
                    title={`${fullLabel}\n${t.start_date} · ${t.duration_days} giorni\nAssegnati: ${assigneeCount}/${requiredCount}`}
                  >
                    {/* Weekend / pause dim overlays — positions are relative to the bar's left edge,
                        and each day uses its layout width so overlays stay aligned with the timeline. */}
                    {(() => {
                      const overlays = []
                      const total = (t.duration_days || 1)
                      for (let i = 0; i < total; i++) {
                        const d = addDays(s, i)
                        const dow = d.getDay()
                        const dxLeft = dateToX(d) - barLeftX - 4 // bar is offset by +4 from barLeftX
                        const dWidth = dateToEndX(d) - dateToX(d)
                        const isPauseDay = pauseSet.has(toISO(d))
                        const isWeekend = dow === 0 || dow === 6
                        if (isPauseDay) {
                          overlays.push(<div key={`p${i}`} style={{
                            position: 'absolute', left: dxLeft, top: 0, bottom: 0, width: dWidth,
                            background: 'repeating-linear-gradient(135deg, rgba(146,64,14,0.28) 0 3px, rgba(146,64,14,0.42) 3px 6px)',
                            pointerEvents: 'none',
                          }} />)
                        } else if (isWeekend) {
                          overlays.push(<div key={`w${i}`} style={{
                            position: 'absolute', left: dxLeft, top: 0, bottom: 0, width: dWidth,
                            background: 'rgba(0,0,0,0.22)', pointerEvents: 'none',
                          }} />)
                        }
                      }
                      return overlays
                    })()}
                    {/* Resize handles — always rendered when editable, even on 1-day bars.
                        Handle width shrinks on narrow bars so a sliver of "move" area remains in the middle. */}
                    {canEdit && (() => {
                      const handleW = w >= 28 ? 8 : Math.max(4, Math.floor((w - 6) / 2))
                      return (
                        <>
                          <div onPointerDown={(ev) => handlePointerDown(ev, t, 'resize-start')}
                            style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: handleW, cursor: 'ew-resize', zIndex: 2 }} />
                          <div onPointerDown={(ev) => handlePointerDown(ev, t, 'resize-end')}
                            style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: handleW, cursor: 'ew-resize', zIndex: 2 }} />
                        </>
                      )
                    })()}
                    {(() => {
                      // Dynamic font size: shrink aggressively as the bar gets narrower so more
                      // of the title fits before the ellipsis kicks in.
                      const labelFont = w >= 200 ? 12 : w >= 150 ? 11 : w >= 110 ? 10 : w >= 80 ? 9 : w >= 55 ? 8 : 7
                      const showDaysBadge = w >= 90
                      return (
                        <>
                          {t.status === 'approved' && (
                            <span title="Completata" style={{
                              flexShrink: 0,
                              width: 18, height: 18, borderRadius: '50%',
                              background: '#10B981', color: '#fff',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 12, fontWeight: 900, lineHeight: 1,
                              boxShadow: '0 0 0 2px #fff',
                              marginRight: 6, marginLeft: 2,
                              position: 'relative',
                            }}>✓</span>
                          )}
                          <span style={{
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            flex: 1, paddingLeft: w < 50 ? 0 : 4, position: 'relative',
                            fontSize: labelFont, lineHeight: 1.1,
                          }}>{fullLabel}</span>
                          {showDaysBadge && (
                            <span style={{ fontSize: 10, opacity: 0.85, marginLeft: 6, flexShrink: 0, position: 'relative' }}>
                              {workingDays(s, e, pauseSet)}g
                            </span>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )
            })}

            {/* Day grid lines + weekend shading (pause days handled separately below) */}
            <div style={{ position: 'absolute', top: HEADER_H, left: LANE_W, width: totalW, height: totalH, pointerEvents: 'none' }}>
              {headerCells.days.map(d => {
                if (d.isPause) return null
                const isWeekend = d.dow === 0 || d.dow === 6
                const isMonday = d.dow === 1
                if (!isWeekend && !isMonday) return null
                return (
                  <div key={+d.date} style={{
                    position: 'absolute', left: d.x, top: 0, width: d.w, height: '100%',
                    background: isWeekend ? 'rgba(148,163,184,0.06)' : 'transparent',
                    borderLeft: isMonday ? '1px solid #E2E8F0' : 'none',
                  }} />
                )
              })}
              {/* Pause bands across the full body — one band per pause range */}
              {pauseRanges.map(p => (
                <div key={`body-pause-${p.id}`} style={{
                  position: 'absolute', left: p.x, top: 0, width: p.w, height: '100%',
                  background: 'rgba(254,243,199,0.55)',
                  borderLeft: '1.5px dashed rgba(245,158,11,0.55)',
                  borderRight: '1.5px dashed rgba(245,158,11,0.55)',
                  boxSizing: 'border-box',
                }} />
              ))}
            </div>

            {/* Today vertical line */}
            {todayX >= 0 && todayX <= totalW && (
              <div style={{
                position: 'absolute', top: 0, left: LANE_W + todayX, width: 2,
                height: HEADER_H + totalH, background: ACCENT, opacity: 0.5,
                pointerEvents: 'none', zIndex: 1,
              }} />
            )}
            {/* Marquee selection box overlay — rendered inside the body wrapper
                so the same body-wrapper-relative coords used by taskBoxes line
                up 1:1 with where the box is drawn. */}
            {marquee && (() => {
              const left = Math.min(marquee.x0, marquee.x1)
              const top = Math.min(marquee.y0, marquee.y1)
              const width = Math.abs(marquee.x1 - marquee.x0)
              const height = Math.abs(marquee.y1 - marquee.y0)
              return (
                <div style={{
                  position: 'absolute', left, top, width, height,
                  background: `${ACCENT}1a`, border: `1.5px solid ${ACCENT}`,
                  pointerEvents: 'none', zIndex: 5,
                }} />
              )
            })()}
          </div>
        </div>
      </div>

      {/* Pause manager — list / add / delete */}
      {showPauseManager && (
        <PauseManagerModal
          pauses={pauses}
          onClose={() => setShowPauseManager(false)}
          onCreate={onCreatePause}
          onDelete={onDeletePause}
          projectStart={currentProject?.start_date}
          projectEnd={currentProject?.end_date}
        />
      )}

      {/* Inline task detail modal — opened by double-click, no page navigation */}
      {selectedTaskId && (() => {
        const t = tasks.find(x => x.id === selectedTaskId)
        if (!t) return null
        return (
          <TaskDetailModal
            task={t} user={user} staff={staff} profiles={profiles} students={students}
            projectStartDate={currentProject?.start_date || null}
            onClose={() => setSelectedTaskId(null)}
            onUpdate={onUpdateTask}
            onSetAssignees={onSetAssignees}
            onDelete={async (...args) => { await onDeleteTask?.(...args); setSelectedTaskId(null) }}
            onReject={onRejectTask}
            onAddWipComment={onAddWipComment}
            onCreateWipUpdate={onCreateWipUpdate}
            onDeleteWipUpdate={onDeleteWipUpdate}
            onCommitForReview={onCommitForReview}
            onMarkWipViewed={onMarkWipViewed}
            addToast={addToast}
            requestConfirm={requestConfirm}
          />
        )
      })()}
    </div>
  )
}

function PauseManagerModal({ pauses, onClose, onCreate, onDelete, projectStart, projectEnd }) {
  const [start, setStart] = useState(projectStart || '')
  const [end, setEnd] = useState(projectEnd || '')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!start || !end) return
    if (end < start) { alert('La data fine deve essere uguale o successiva a quella di inizio'); return }
    setSaving(true)
    await onCreate(start, end, label.trim() || null)
    setSaving(false)
    setLabel('')
  }

  const inputStyle = {
    fontSize: 13, color: '#1a1a1a', border: '1px solid #E2E8F0',
    borderRadius: 10, padding: '9px 12px', outline: 'none', background: '#F8FAFC',
    fontFamily: 'inherit',
  }

  return (
    <Modal open onClose={onClose} title="Pause progetto" width={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
          I giorni dentro una pausa vengono compressi nella timeline (resi piccoli e grigi) per non sprecare spazio.
          Le date dei task non vengono modificate.
        </p>

        {/* Existing list */}
        <div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8, fontWeight: 600 }}>Pause esistenti</div>
          {pauses.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', padding: '10px 12px', background: '#F8FAFC', border: '1px dashed #CBD5E1', borderRadius: 8 }}>
              Nessuna pausa configurata.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pauses.map(p => (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10,
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>
                    {p.label || 'Pausa'}
                  </span>
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    {p.start_date} → {p.end_date}
                  </span>
                  <button onClick={() => onDelete(p.id)} style={{
                    marginLeft: 'auto', background: 'transparent', border: 'none',
                    color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}>Elimina</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new */}
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: 14 }}>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8, fontWeight: 600 }}>Nuova pausa</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Inizio</div>
              <DateInput value={start} onChange={setStart} placeholder="Data inizio" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Fine</div>
              <DateInput value={end} minDate={start || undefined} onChange={setEnd} placeholder="Data fine" popoverAlign="right" />
            </div>
          </div>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Etichetta (es. Pausa estiva)"
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 12 }} />
          <Btn variant="primary" onClick={handleAdd} loading={saving} disabled={!start || !end || saving}>
            Aggiungi pausa
          </Btn>
        </div>
      </div>
    </Modal>
  )
}

function shade(hex, percent) {
  if (!hex || !hex.startsWith('#')) return hex
  let h = hex.slice(1); if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (percent / 100) * 255)))
  return '#' + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, '0')).join('')
}

// Pull a colour toward its luma-equivalent gray. amount 0..1 — preserves brightness,
// reduces chroma. Used by the lane aggregate bars so they stay dark but less vivid.
function desaturate(hex, amount) {
  if (!hex || !hex.startsWith('#')) return hex
  let h = hex.slice(1); if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff
  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (gray - c) * amount)))
  return '#' + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, '0')).join('')
}
