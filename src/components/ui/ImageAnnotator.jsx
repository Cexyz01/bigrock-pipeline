import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Img from './Img'
import { AnnotationOverlay } from './AnnotatedImage'
import { useImageAnnotation } from '../../hooks/useImageAnnotations'

// Fullscreen pen-on-image editor. Opens over the current page (no nav). Pen
// strokes are stored in normalised [0..1] of the image's natural size so they
// replay correctly anywhere the image appears.
//
// Tools: pen, eraser (whole-stroke), undo, save, close. Eraser removes any
// stroke whose path passes within a small radius of the cursor.

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#0f172a', '#ffffff']
const ERASER_RADIUS_FRAC = 0.015 // 1.5% of image width

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

function strokeHitByEraser(stroke, ex, ey, r) {
  const pts = stroke.points || []
  if (pts.length === 0) return false
  if (pts.length === 1) {
    const dx = pts[0][0] - ex, dy = pts[0][1] - ey
    return (dx * dx + dy * dy) <= r * r
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (pointNearSegment(ex, ey, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r)) return true
  }
  return false
}

export default function ImageAnnotator({ src, onClose, addToast }) {
  const { strokes: saved, save } = useImageAnnotation(src)
  const [strokes, setStrokes] = useState(saved)
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(0.005) // fraction of image width
  const [drawing, setDrawing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  // Resync when the upstream cache loads (saved arrives async on first open)
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (hydratedRef.current) return
    if (saved && saved.length >= 0) { setStrokes(saved); hydratedRef.current = true }
  }, [saved])

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

  // ── Drawing handlers ──
  const onPointerDown = (e) => {
    if (!rect.w) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = screenToNorm(e.clientX, e.clientY); if (!p) return
    if (tool === 'pen') {
      setDrawing(true)
      setStrokes(prev => [...prev, { color, size, points: [p] }])
      setDirty(true)
    } else if (tool === 'eraser') {
      setDrawing(true)
      eraseAt(p[0], p[1])
    }
  }

  const onPointerMove = (e) => {
    if (!drawing || !rect.w) return
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
    setDrawing(false)
  }

  const eraseAt = useCallback((x, y) => {
    const r = ERASER_RADIUS_FRAC
    setStrokes(prev => {
      const next = prev.filter(s => !strokeHitByEraser(s, x, y, r))
      if (next.length !== prev.length) setDirty(true)
      return next
    })
  }, [])

  const undo = () => {
    setStrokes(prev => prev.slice(0, -1))
    setDirty(true)
  }
  const clearAll = () => {
    setStrokes([])
    setDirty(true)
  }
  const handleSave = async () => {
    setSaving(true)
    const { error } = await save(strokes)
    setSaving(false)
    if (error) {
      addToast?.('Errore nel salvataggio annotazioni', 'danger')
      return
    }
    addToast?.('Annotazioni salvate', 'success')
    onClose?.()
  }
  const handleClose = () => {
    if (dirty) {
      if (!window.confirm('Hai modifiche non salvate. Chiudere senza salvare?')) return
    }
    onClose?.()
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose()
      else if (e.key === 'b' || e.key === 'B') setTool('pen')
      else if (e.key === 'e' || e.key === 'E') setTool('eraser')
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); undo() }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); handleSave() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dirty, strokes])

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
        <button onClick={undo} style={toolBtnStyle(false)}>↶ Undo</button>
        <button onClick={clearAll} style={toolBtnStyle(false)}>🗑 Pulisci</button>
        <button onClick={handleSave} disabled={saving} style={{
          ...toolBtnStyle(true),
          background: '#F28C28', borderColor: '#F28C28', color: '#fff',
          opacity: saving ? 0.6 : 1,
        }}>{saving ? 'Salvataggio…' : '💾 Salva'}</button>
        <button onClick={handleClose} style={toolBtnStyle(false)}>✕ Chiudi</button>
      </div>

      {/* Drawing surface */}
      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          cursor: tool === 'eraser' ? 'cell' : 'crosshair',
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
