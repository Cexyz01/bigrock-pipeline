import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Img from './Img'
import { AnnotationOverlay } from './AnnotatedImage'
import { useImageAnnotation } from '../../hooks/useImageAnnotations'

// Fullscreen pen-on-image editor. Opens over the current page (no nav). Pen
// strokes are stored in normalised [0..1] of the image's natural size so they
// replay correctly anywhere the image appears.
//
// Tools: pen, eraser (point-level brush — same feel as the storyboard eraser),
// undo, clear, auto-save, close. The dark margin around the image acts as a
// click-to-close zone — drawing is clipped to the image rect.

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#0f172a', '#ffffff']
const ERASER_RADIUS_FRAC = 0.015 // default eraser radius (fraction of image width)

function computeImageRect(natW, natH, cW, cH) {
  if (!natW || !natH || !cW || !cH) return { x: 0, y: 0, w: cW || 0, h: cH || 0 }
  const imgAR = natW / natH
  const ctnAR = cW / cH
  if (imgAR > ctnAR) { const w = cW, h = w / imgAR; return { x: 0, y: (cH - h) / 2, w, h } }
  const h = cH, w = h * imgAR; return { x: (cW - w) / 2, y: 0, w, h }
}

function pointNearSegment(px, py, ax, ay, bx, by, r) {
  const dx = bx - ax, dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * dx, cy = ay + t * dy
  const ex = px - cx, ey = py - cy
  return (ex * ex + ey * ey) <= r * r
}

// Point-level eraser: walk a stroke's points, drop every one within radius of
// the cursor, and re-emit the surviving runs as separate strokes. This is the
// "brush eraser" feel from the creative storyboard — gaps cut a stroke into
// two instead of nuking the whole thing.
function eraseStrokeAtPoint(stroke, ex, ey, r) {
  const pts = stroke.points || []
  if (pts.length === 0) return [stroke]
  const r2 = r * r
  const keep = pts.map(p => {
    const dx = p[0] - ex, dy = p[1] - ey
    return (dx * dx + dy * dy) > r2
  })
  if (keep.every(Boolean)) return [stroke]              // nothing erased
  if (keep.every(k => !k)) return []                    // whole stroke gone
  const segs = []
  let cur = []
  for (let i = 0; i < pts.length; i++) {
    if (keep[i]) cur.push(pts[i])
    else if (cur.length > 0) { segs.push(cur); cur = [] }
  }
  if (cur.length > 0) segs.push(cur)
  return segs
    .filter(s => s.length > 0)
    .map(points => ({ ...stroke, points }))
}

export default function ImageAnnotator({ src, onClose, addToast }) {
  const { strokes: saved, save } = useImageAnnotation(src)
  const [strokes, setStrokes] = useState(saved)
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(0.005) // fraction of image width
  const [drawing, setDrawing] = useState(false)
  // Auto-save lifecycle: 'idle' (no pending changes), 'pending' (debounce
  // running), 'saving' (network in flight), 'saved' (last flush succeeded —
  // shown briefly then back to idle).
  const [saveState, setSaveState] = useState('idle')
  const strokesRef = useRef(strokes)
  strokesRef.current = strokes
  const saveTimerRef = useRef(null)
  const savedFlashTimerRef = useRef(null)
  const lastSavedJsonRef = useRef(JSON.stringify(saved || []))

  // Resync when the upstream cache loads (saved arrives async on first open).
  // We only adopt the server state once; further upstream pushes (e.g. our own
  // optimistic updates after auto-save) shouldn't clobber in-progress strokes.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current) return
    if (saved && saved.length >= 0) {
      setStrokes(saved)
      strokesRef.current = saved
      lastSavedJsonRef.current = JSON.stringify(saved)
      hydratedRef.current = true
    }
  }, [saved])

  const flushSave = useCallback(async () => {
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    const payload = strokesRef.current
    const json = JSON.stringify(payload)
    if (json === lastSavedJsonRef.current) return
    setSaveState('saving')
    const { error } = await save(payload)
    if (error) {
      setSaveState('idle')
      addToast?.('Errore nel salvataggio annotazioni', 'danger')
      return
    }
    lastSavedJsonRef.current = json
    setSaveState('saved')
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current)
    savedFlashTimerRef.current = setTimeout(() => setSaveState('idle'), 1100)
  }, [save, addToast])

  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setSaveState('pending')
    saveTimerRef.current = setTimeout(() => { saveTimerRef.current = null; flushSave() }, 600)
  }, [flushSave])

  // On unmount: flush any pending changes synchronously-ish (fire-and-forget,
  // the cache is already optimistic so the overlay shows it immediately).
  useEffect(() => () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
      flushSave()
    }
    if (savedFlashTimerRef.current) clearTimeout(savedFlashTimerRef.current)
  }, [flushSave])

  const wrapRef = useRef(null)
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })
  const [natural, setNatural] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    const update = () => {
      const r = el.getBoundingClientRect()
      setContainerSize({ w: r.width, h: r.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rect = computeImageRect(natural.w, natural.h, containerSize.w, containerSize.h)

  const screenToNorm = useCallback((clientX, clientY) => {
    if (!wrapRef.current || !rect.w) return null
    const wrap = wrapRef.current.getBoundingClientRect()
    const x = (clientX - wrap.left - rect.x) / rect.w
    const y = (clientY - wrap.top - rect.y) / rect.h
    return [x, y]
  }, [rect])

  // Cursor position in surface coords — drives the brush-size preview ring so
  // the user can see at a glance how thick a stroke / how wide the eraser is.
  const [cursorPos, setCursorPos] = useState(null)

  // True if (clientX, clientY) is over the actual image, not the dark margin.
  const isInsideImage = (clientX, clientY) => {
    if (!wrapRef.current || !rect.w) return false
    const wrap = wrapRef.current.getBoundingClientRect()
    const lx = clientX - wrap.left, ly = clientY - wrap.top
    return lx >= rect.x && lx <= rect.x + rect.w
        && ly >= rect.y && ly <= rect.y + rect.h
  }

  // ── Drawing handlers ──
  const onPointerDown = (e) => {
    if (!rect.w) return
    // Outside the image = click-to-close zone, never a drawing surface.
    if (!isInsideImage(e.clientX, e.clientY)) { handleClose(); return }
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = screenToNorm(e.clientX, e.clientY); if (!p) return
    if (tool === 'pen') {
      setDrawing(true)
      setStrokes(prev => [...prev, { color, size, points: [p] }])
    } else if (tool === 'eraser') {
      setDrawing(true)
      eraseAt(p[0], p[1])
    }
  }

  const onPointerMove = (e) => {
    if (!rect.w) return
    // Update cursor preview — but only when over the image, so the brush ring
    // doesn't sit in the close-zone margin.
    const wrap = wrapRef.current?.getBoundingClientRect()
    const inside = isInsideImage(e.clientX, e.clientY)
    if (wrap && inside) setCursorPos({ x: e.clientX - wrap.left, y: e.clientY - wrap.top })
    else setCursorPos(null)
    if (!drawing) return
    if (!inside) return
    const p = screenToNorm(e.clientX, e.clientY); if (!p) return
    if (tool === 'pen') {
      setStrokes(prev => {
        if (prev.length === 0) return prev
        const last = prev[prev.length - 1]
        // Throttle to avoid runaway points: ignore if too close to previous.
        const lp = last.points[last.points.length - 1]
        const dx = p[0] - lp[0], dy = p[1] - lp[1]
        if (dx * dx + dy * dy < 1e-6) return prev
        const next = prev.slice(0, -1)
        next.push({ ...last, points: [...last.points, p] })
        return next
      })
    } else if (tool === 'eraser') {
      eraseAt(p[0], p[1])
    }
  }

  const onPointerUp = () => {
    if (drawing) scheduleSave()
    setDrawing(false)
  }

  // Eraser uses the same `size` slider as the pen so the cursor ring and the
  // actual erase footprint always match.
  const eraseAt = useCallback((x, y) => {
    const r = size
    setStrokes(prev => {
      const next = []
      let changed = false
      for (const s of prev) {
        const out = eraseStrokeAtPoint(s, x, y, r)
        if (out.length === 1 && out[0] === s) { next.push(s); continue }
        changed = true
        for (const ns of out) next.push(ns)
      }
      return changed ? next : prev
    })
  }, [size])

  const undo = () => {
    setStrokes(prev => prev.slice(0, -1))
    scheduleSave()
  }
  const clearAll = () => {
    setStrokes([])
    scheduleSave()
  }
  const handleClose = () => {
    // flushSave (called on unmount) will persist any pending changes.
    onClose?.()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose()
      else if (e.key === 'b' || e.key === 'B') setTool('pen')
      else if (e.key === 'e' || e.key === 'E') setTool('eraser')
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100000,
      background: 'rgba(15,23,42,0.92)', backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
        background: 'rgba(0,0,0,0.55)', borderBottom: '1px solid rgba(255,255,255,0.08)',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setTool('pen')} title="Penna (B)" style={toolBtnStyle(tool === 'pen')}>✏️ Penna</button>
          <button onClick={() => setTool('eraser')} title="Gomma (E)" style={toolBtnStyle(tool === 'eraser')}>🩹 Gomma</button>
        </div>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); setTool('pen') }} title={c} style={{
              width: 22, height: 22, borderRadius: '50%', background: c,
              border: color === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.25)',
              cursor: 'pointer',
            }} />
          ))}
        </div>
        <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.15)' }} />
        <label style={{ color: '#cbd5e1', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          Spessore
          <input
            type="range" min="0.002" max="0.025" step="0.001" value={size}
            onChange={e => setSize(parseFloat(e.target.value))}
            style={{ width: 120 }}
          />
        </label>
        <div style={{ flex: 1 }} />
        <span style={{
          fontSize: 11, color: saveState === 'saved' ? '#86efac' : '#cbd5e1',
          minWidth: 78, textAlign: 'right',
          transition: 'color 0.2s ease',
        }}>
          {saveState === 'saving' ? 'Salvataggio…'
            : saveState === 'pending' ? 'Modifiche…'
            : saveState === 'saved' ? '✓ Salvato'
            : ''}
        </span>
        <button onClick={undo} style={toolBtnStyle(false)}>↶ Undo</button>
        <button onClick={clearAll} style={toolBtnStyle(false)}>🗑 Pulisci</button>
        <button onClick={handleClose} style={toolBtnStyle(false)}>✕ Chiudi</button>
      </div>

      {/* Drawing surface */}
      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setCursorPos(null)}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          // Hide native cursor — the brush-size ring below is the cursor.
          cursor: rect.w > 0 ? 'none' : 'default',
          touchAction: 'none',
        }}
      >
        {/* Centered image */}
        {rect.w > 0 && (
          <div style={{
            position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h,
            pointerEvents: 'none',
          }}>
            <Img src={src} w={1920} h={1920} fit="limit" alt="" style={{
              width: '100%', height: '100%', objectFit: 'fill', display: 'block',
              userSelect: 'none', pointerEvents: 'none',
            }} />
          </div>
        )}
        {/* Hidden img for natural-size detection (so rect math works even before
            the visible img has rendered into its computed slot). */}
        <img
          src={src}
          alt=""
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
        {/* Strokes overlay */}
        <AnnotationOverlay strokes={strokes} rect={rect} />
        {/* Brush-size cursor ring — true-to-scale preview of pen / eraser */}
        {cursorPos && rect.w > 0 && (() => {
          const diameter = tool === 'eraser'
            ? size * 2 * rect.w
            : size * rect.w
          const isEraser = tool === 'eraser'
          return (
            <div style={{
              position: 'absolute',
              left: cursorPos.x - diameter / 2,
              top: cursorPos.y - diameter / 2,
              width: diameter, height: diameter, borderRadius: '50%',
              pointerEvents: 'none',
              background: isEraser ? 'rgba(255,255,255,0.18)' : color,
              border: isEraser
                ? '1.5px dashed rgba(255,255,255,0.9)'
                : `1px solid rgba(255,255,255,0.7)`,
              boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
              mixBlendMode: isEraser ? 'normal' : 'normal',
              transition: 'width 0.05s linear, height 0.05s linear',
            }} />
          )
        })()}
      </div>
    </div>,
    document.body,
  )
}

function toolBtnStyle(active) {
  return {
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
    background: active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)',
    color: '#fff',
    border: `1px solid ${active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
    cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6,
  }
}
