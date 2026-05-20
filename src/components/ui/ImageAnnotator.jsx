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

  // ── Pan / zoom ──
  // Transform is held in a ref + applied imperatively to the stage so panning
  // and wheel-zoom don't trigger React re-renders during the gesture.
  const stageRef = useRef(null)
  const xformRef = useRef({ scale: 1, panX: 0, panY: 0 })
  const applyXform = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    const { scale, panX, panY } = xformRef.current
    el.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`
  }, [])
  useLayoutEffect(applyXform, [applyXform, rect.w])

  const screenToNorm = useCallback((clientX, clientY) => {
    if (!wrapRef.current || !rect.w) return null
    const wrap = wrapRef.current.getBoundingClientRect()
    const { scale, panX, panY } = xformRef.current
    const lx = (clientX - wrap.left - panX) / scale
    const ly = (clientY - wrap.top - panY) / scale
    const x = (lx - rect.x) / rect.w
    const y = (ly - rect.y) / rect.h
    return [x, y]
  }, [rect])

  // Brush-size preview ring. Updated imperatively (DOM .style writes) instead
  // of React state so the cursor follows the pointer at native refresh rate
  // even while a stroke is being drawn — React re-renders for state changes
  // can't keep up with high-frequency pointermove on busy canvases.
  const cursorRef = useRef(null)
  // Brush diameter on screen depends on the current zoom (the stored stroke
  // size is fraction of natural image width, and the image is scaled by
  // zoom in the stage), so we always read xformRef when sizing the cursor.
  const cursorDiameter = useCallback(() => {
    const { scale } = xformRef.current
    return (tool === 'eraser' ? size * 2 : size) * rect.w * scale
  }, [tool, size, rect.w])
  const updateCursorVisual = useCallback(() => {
    const el = cursorRef.current
    if (!el || !rect.w) return
    const d = cursorDiameter()
    el.style.width = el.style.height = `${d}px`
    if (tool === 'eraser') {
      el.style.background = 'rgba(255,255,255,0.18)'
      el.style.borderStyle = 'dashed'
      el.style.borderColor = 'rgba(255,255,255,0.9)'
    } else {
      el.style.background = color
      el.style.borderStyle = 'solid'
      el.style.borderColor = 'rgba(255,255,255,0.7)'
    }
  }, [tool, size, color, rect.w, cursorDiameter])
  useEffect(updateCursorVisual, [updateCursorVisual])
  const moveCursor = useCallback((x, y) => {
    const el = cursorRef.current
    if (!el) return
    const d = cursorDiameter()
    el.style.width = el.style.height = `${d}px`
    el.style.transform = `translate3d(${x - d / 2}px, ${y - d / 2}px, 0)`
    el.style.display = 'block'
  }, [cursorDiameter])
  const hideCursor = useCallback(() => {
    const el = cursorRef.current
    if (el) el.style.display = 'none'
  }, [])

  // True if (clientX, clientY) is over the actual image after pan/zoom,
  // not the dark margin around it.
  const isInsideImage = (clientX, clientY) => {
    if (!wrapRef.current || !rect.w) return false
    const wrap = wrapRef.current.getBoundingClientRect()
    const { scale, panX, panY } = xformRef.current
    const lx = (clientX - wrap.left - panX) / scale
    const ly = (clientY - wrap.top - panY) / scale
    return lx >= rect.x && lx <= rect.x + rect.w
        && ly >= rect.y && ly <= rect.y + rect.h
  }

  // ── Pan + wheel zoom handlers ──
  const panningRef = useRef(null) // { startX, startY, originPanX, originPanY }
  const onWheel = useCallback((e) => {
    if (!rect.w || !wrapRef.current) return
    e.preventDefault()
    const wrap = wrapRef.current.getBoundingClientRect()
    const cx = e.clientX - wrap.left
    const cy = e.clientY - wrap.top
    const cur = xformRef.current
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const nextScale = Math.max(0.2, Math.min(8, cur.scale * factor))
    if (nextScale === cur.scale) return
    // Anchor the zoom to the cursor: the world point under the cursor must
    // stay under the cursor after scaling.
    const k = nextScale / cur.scale
    const nextPanX = cx - (cx - cur.panX) * k
    const nextPanY = cy - (cy - cur.panY) * k
    xformRef.current = { scale: nextScale, panX: nextPanX, panY: nextPanY }
    applyXform()
    moveCursor(cx, cy)
  }, [rect.w, applyXform, moveCursor])
  // Wheel events on a passive listener can't preventDefault, so we attach
  // a non-passive listener via a layout effect (React's default is passive).
  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const handler = (e) => onWheel(e)
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [onWheel])
  const resetZoom = () => {
    xformRef.current = { scale: 1, panX: 0, panY: 0 }
    applyXform()
    updateCursorVisual()
  }

  // ── Drawing / pan handlers ──
  const onPointerDown = (e) => {
    if (!rect.w) return
    // Right-mouse / middle-mouse → pan, regardless of where on the surface.
    if (e.button === 2 || e.button === 1) {
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      const cur = xformRef.current
      panningRef.current = {
        startX: e.clientX, startY: e.clientY,
        originPanX: cur.panX, originPanY: cur.panY,
      }
      hideCursor()
      return
    }
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

  // rAF-batched flush. Pointer events fire faster than the screen refreshes,
  // so we collect raw points in refs and apply them once per frame. Without
  // this, every pointermove triggered setStrokes → SVG re-render of every
  // existing path, which made the eraser feel sluggish on busy canvases.
  const pendingPenPointsRef = useRef([])
  const pendingErasePointsRef = useRef([])
  const flushRafRef = useRef(0)
  const requestFlush = useCallback(() => {
    if (flushRafRef.current) return
    flushRafRef.current = requestAnimationFrame(() => {
      flushRafRef.current = 0
      const penPts = pendingPenPointsRef.current
      const erasePts = pendingErasePointsRef.current
      if (penPts.length === 0 && erasePts.length === 0) return
      pendingPenPointsRef.current = []
      pendingErasePointsRef.current = []
      setStrokes(prev => {
        let next = prev
        if (penPts.length > 0 && next.length > 0) {
          const last = next[next.length - 1]
          const lastPts = last.points
          const lp = lastPts[lastPts.length - 1]
          // Drop sub-pixel duplicates so the path stays compact.
          const merged = [...lastPts]
          let prevX = lp[0], prevY = lp[1]
          for (const p of penPts) {
            const dx = p[0] - prevX, dy = p[1] - prevY
            if (dx * dx + dy * dy < 1e-6) continue
            merged.push(p); prevX = p[0]; prevY = p[1]
          }
          if (merged.length !== lastPts.length) {
            next = next.slice(0, -1)
            next.push({ ...last, points: merged })
          }
        }
        if (erasePts.length > 0) {
          let arr = next
          let changed = false
          for (const [x, y, r] of erasePts) {
            const out = []
            for (const s of arr) {
              const split = eraseStrokeAtPoint(s, x, y, r)
              if (split.length === 1 && split[0] === s) { out.push(s); continue }
              changed = true
              for (const ns of split) out.push(ns)
            }
            arr = out
          }
          if (changed) next = arr
        }
        return next
      })
    })
  }, [])

  const onPointerMove = (e) => {
    if (!rect.w) return
    // Panning takes priority — neither the cursor ring nor drawing fires.
    if (panningRef.current) {
      const p = panningRef.current
      xformRef.current = {
        ...xformRef.current,
        panX: p.originPanX + (e.clientX - p.startX),
        panY: p.originPanY + (e.clientY - p.startY),
      }
      applyXform()
      return
    }
    const wrap = wrapRef.current?.getBoundingClientRect()
    const inside = isInsideImage(e.clientX, e.clientY)
    if (wrap && inside) moveCursor(e.clientX - wrap.left, e.clientY - wrap.top)
    else hideCursor()
    if (!drawing) return
    if (!inside) return
    const p = screenToNorm(e.clientX, e.clientY); if (!p) return
    if (tool === 'pen') {
      pendingPenPointsRef.current.push(p)
    } else if (tool === 'eraser') {
      pendingErasePointsRef.current.push([p[0], p[1], size])
    }
    requestFlush()
  }

  const onPointerUp = () => {
    if (panningRef.current) { panningRef.current = null; return }
    // Flush any queued points so the gesture ends with a consistent state.
    if (flushRafRef.current) {
      cancelAnimationFrame(flushRafRef.current)
      flushRafRef.current = 0
    }
    const penPts = pendingPenPointsRef.current
    const erasePts = pendingErasePointsRef.current
    if (penPts.length > 0 || erasePts.length > 0) {
      pendingPenPointsRef.current = []
      pendingErasePointsRef.current = []
      setStrokes(prev => {
        let next = prev
        if (penPts.length > 0 && next.length > 0) {
          const last = next[next.length - 1]
          const merged = [...last.points, ...penPts]
          next = next.slice(0, -1)
          next.push({ ...last, points: merged })
        }
        if (erasePts.length > 0) {
          let arr = next
          for (const [x, y, r] of erasePts) {
            const out = []
            for (const s of arr) {
              const split = eraseStrokeAtPoint(s, x, y, r)
              for (const ns of split) out.push(ns)
            }
            arr = out
          }
          next = arr
        }
        return next
      })
    }
    if (drawing) scheduleSave()
    setDrawing(false)
  }

  // Single-click erase (used on pointerdown) — same logic as the rAF flush
  // but applied immediately so the very first dab is visible without waiting
  // for a pointermove.
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
        <button onClick={resetZoom} title="Reset zoom (1:1)" style={toolBtnStyle(false)}>⌖ 1:1</button>
        <button onClick={handleClose} style={toolBtnStyle(false)}>✕ Chiudi</button>
      </div>

      {/* Drawing surface */}
      <div
        ref={wrapRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={hideCursor}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          // Hide native cursor — the brush-size ring below is the cursor.
          cursor: rect.w > 0 ? 'none' : 'default',
          touchAction: 'none',
        }}
      >
        {/* Stage — image + strokes live here together so wheel-zoom and
            right-click pan transform them in lockstep. */}
        <div
          ref={stageRef}
          style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            transformOrigin: '0 0', willChange: 'transform',
            pointerEvents: 'none',
          }}
        >
          {rect.w > 0 && (
            <div style={{
              position: 'absolute', left: rect.x, top: rect.y, width: rect.w, height: rect.h,
            }}>
              <Img src={src} w={1920} h={1920} fit="limit" alt="" style={{
                width: '100%', height: '100%', objectFit: 'fill', display: 'block',
                userSelect: 'none', pointerEvents: 'none',
              }} />
            </div>
          )}
          <AnnotationOverlay strokes={strokes} rect={rect} />
        </div>
        {/* Hidden img for natural-size detection (so rect math works even before
            the visible img has rendered into its computed slot). */}
        <img
          src={src}
          alt=""
          onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
        />
        {/* Brush-size cursor ring — positioned imperatively via translate3d so
            it tracks the pointer without going through React's render cycle. */}
        <div
          ref={cursorRef}
          style={{
            position: 'absolute', top: 0, left: 0,
            borderRadius: '50%', pointerEvents: 'none',
            borderWidth: 1, willChange: 'transform',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
            display: 'none',
          }}
        />
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
