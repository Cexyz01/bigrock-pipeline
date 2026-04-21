import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import { SHOT_DEPTS, ASSET_DEPTS, SHOT_STATUSES, getShotStatus, ACCENT, isDeptEnabled, isAudioUrl } from '../../lib/constants'
import { supabase, getStoryboardImages, getStickers, createSticker, updateSticker, deleteSticker, uploadStickerImage } from '../../lib/supabase'
import useIsMobile from '../../hooks/useIsMobile'
import { IconX, IconSearch, IconLayout, IconTarget } from '../ui/Icons'
import { cld } from '../../lib/cld'

// ── Constants ──
const STATUS_KEY = dept => `status_${dept === 'compositing' ? 'compositing' : dept}`
const HDR_H = 44
const CELL_GAP = 4

// Board mode cell sizes
const B_CELL_W = 420
const B_CELL_H = 280
const B_SHOT_W = 180
const B_REF_W = 450
const B_DESC_W = 260
const B_GAP = 10
const B_SEQ_H = 36
const B_HDR_H = 48

function thumbUrl(url, w = 300, h = 260) {
  if (!url) return null
  if (url.includes('/upload/')) return url.replace('/upload/', `/upload/c_fit,w_${w},h_${h},q_auto,f_auto/`)
  return url
}

// ══════════════════════════════════════════════════
// LIGHTBOX
// ══════════════════════════════════════════════════

function GalleryLightbox({ images, index, shotCode, deptLabel, statusObj, onClose, onNav }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onNav(1)
      if (e.key === 'ArrowLeft') onNav(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNav])
  if (!images?.length) return null
  const img = images[index] || images[0]
  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.15s ease', cursor: 'zoom-out',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', cursor: 'default',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{shotCode}</span>
          {deptLabel && <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{deptLabel}</span>}
          {statusObj && <span style={{ background: statusObj.bg, color: statusObj.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{statusObj.label}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {images.length > 1 && <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{index + 1} / {images.length}</span>}
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}><IconX size={18} /></button>
        </div>
      </div>
      {isAudioUrl(img.image_url) ? (
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: '24px 32px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 8px 60px rgba(0,0,0,0.5)' }}>
          <span style={{ fontSize: 32 }}>&#9835;</span>
          <audio controls src={img.image_url} autoPlay style={{ minWidth: 300 }} />
        </div>
      ) : (
        <img src={cld(img.image_url, { w: 1920, h: 1920, fit: 'limit' })} alt="" onClick={e => e.stopPropagation()} style={{ maxWidth: '88vw', maxHeight: '80vh', borderRadius: 6, objectFit: 'contain', cursor: 'default', boxShadow: '0 8px 60px rgba(0,0,0,0.5)' }} />
      )}
      {images.length > 1 && <>
        <button onClick={e => { e.stopPropagation(); onNav(-1) }} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 24, fontWeight: 700, backdropFilter: 'blur(4px)' }}>&lsaquo;</button>
        <button onClick={e => { e.stopPropagation(); onNav(1) }} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 24, fontWeight: 700, backdropFilter: 'blur(4px)' }}>&rsaquo;</button>
      </>}
    </div>,
    document.body,
  )
}

// ══════════════════════════════════════════════════
// BOARD CELL (shared between grid + board mode)
// ══════════════════════════════════════════════════

const fmtTime = (s) => {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

const AudioMiniPlayer = memo(function AudioMiniPlayer({ url }) {
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [curTime, setCurTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioElRef = useRef(null)

  const togglePlay = (e) => {
    e.stopPropagation()
    const el = audioElRef.current
    if (!el) return
    if (el.paused) { el.play().catch(() => {}); setAudioPlaying(true) }
    else { el.pause(); setAudioPlaying(false) }
  }

  useEffect(() => {
    const el = audioElRef.current
    if (!el) return
    const onTime = () => { if (el.duration) { setProgress((el.currentTime / el.duration) * 100); setCurTime(el.currentTime) } }
    const onMeta = () => { setDuration(el.duration || 0) }
    const onEnd = () => { setAudioPlaying(false); setProgress(0); setCurTime(0) }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('ended', onEnd)
    return () => { el.removeEventListener('timeupdate', onTime); el.removeEventListener('loadedmetadata', onMeta); el.removeEventListener('ended', onEnd) }
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0', width: '100%', boxSizing: 'border-box' }}>
      <audio ref={audioElRef} src={url} preload="metadata" />
      <button onClick={togglePlay} style={{
        width: 34, height: 34, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: 'pointer',
        background: audioPlaying ? '#EF4444' : ACCENT, color: '#fff', fontSize: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{audioPlaying ? '||' : '\u25B6'}</button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace', fontWeight: 600 }}>{fmtTime(curTime)}</span>
          <span style={{ fontSize: 10, color: '#B0B8C4' }}>/</span>
          <span style={{ fontSize: 11, color: '#94A3B8', fontFamily: 'monospace' }}>{fmtTime(duration)}</span>
        </div>
        <div style={{ height: 4, borderRadius: 2, background: '#E2E8F0', overflow: 'hidden', cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation()
            const el = audioElRef.current
            if (!el || !el.duration) return
            const rect = e.currentTarget.getBoundingClientRect()
            el.currentTime = ((e.clientX - rect.left) / rect.width) * el.duration
          }}>
          <div style={{ height: '100%', borderRadius: 2, background: ACCENT, width: `${progress}%`, transition: 'width 0.15s linear' }} />
        </div>
        <div style={{ fontSize: 9, color: '#94A3B8', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {url.split('/').pop()?.replace(/\.[^.]+$/, '')}
        </div>
      </div>
    </div>
  )
})

const BoardCell = memo(function BoardCell({ images, status, onClickImage, cellH, disabled }) {
  const count = images?.length || 0

  if (disabled) return <div style={{ height: cellH }} />

  if (count === 0) return <div style={{ height: cellH }} />

  if (count === 1) {
    if (isAudioUrl(images[0].image_url)) return (
      <div style={{ height: cellH, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
        <AudioMiniPlayer url={images[0].image_url} />
      </div>
    )
    return (
      <div style={{ height: cellH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={thumbUrl(images[0].image_url, 400, 225)} alt="" onClick={() => onClickImage(0)}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', borderRadius: 6, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
      </div>
    )
  }

  const cols = 2, rows = Math.ceil(count / cols)
  return (
    <div style={{ height: cellH, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)`, gap: 4, padding: 2 }}>
      {images.map((img, i) => (
        <div key={img.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isAudioUrl(img.image_url) ? (
            <AudioMiniPlayer url={img.image_url} />
          ) : (
            <img src={thumbUrl(img.image_url, 280, 158)} alt="" onClick={() => onClickImage(i)}
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', borderRadius: 5, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
          )}
        </div>
      ))}
    </div>
  )
})

// Cloudinary fit (no crop) for references
function refThumbUrl(url, w = 320, h = 180) {
  if (!url) return null
  if (url.includes('/upload/')) return url.replace('/upload/', `/upload/c_fit,w_${w},h_${h},q_auto,f_auto/`)
  return url
}

const RefCell = memo(function RefCell({ url, onClick, cellH }) {
  const [hov, setHov] = useState(false)
  if (!url) return <div style={{ height: cellH }} />
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ height: cellH, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '1px solid #E8ECF1', background: '#fff', transition: 'all 0.15s ease', transform: hov ? 'translateY(-1px)' : 'none', boxShadow: hov ? '0 6px 20px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <img src={refThumbUrl(url, 400, 225)} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }} />
    </div>
  )
})

// Row height: base 240px, grows only when multiple images need grid rows
function computeRowH(item, imageMap, depts) {
  const BASE = 240
  let maxGridH = 0

  for (const d of depts) {
    const imgs = imageMap[`${item.id}__${d.id}`] || []
    if (imgs.length <= 1) continue
    // Multiple images in 2-col grid — each row ~160px
    const rows = Math.ceil(imgs.length / 2)
    const gridH = rows * 160 + (rows - 1) * 4 + 8
    maxGridH = Math.max(maxGridH, gridH)
  }

  return Math.max(BASE, maxGridH)
}

// ══════════════════════════════════════════════════
// CANVAS / BOARD VIEW — pan & zoom whiteboard
// ══════════════════════════════════════════════════

function CanvasBoard({ sequences, imageMap, depts, getCode, getRefUrl, getDescription, getDeptStatus, getDeptDisabled, openCellImage, openRef, funMode, stickers, onStickerUpdate, onStickerDelete, onStickerDrop }) {
  const DEPT_LABELS = ['Item', 'Reference', 'Description', ...depts.map(d => d.label)]
  const DEPT_COLORS = [null, null, null, ...depts.map(d => d.color)]
  const containerRef = useRef(null)
  const [scale, setScale] = useState(0.55)
  const [pan, setPan] = useState(null) // null = needs centering
  const [dragging, setDragging] = useState(false)
  const [dropHighlight, setDropHighlight] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // Zoom toward cursor
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left // mouse X relative to container
      const my = e.clientY - rect.top  // mouse Y relative to container
      const factor = e.deltaY > 0 ? 0.92 : 1.08

      setScale(prev => {
        const next = Math.min(5, Math.max(0.1, prev * factor))
        const ratio = next / prev
        // Adjust pan so the point under cursor stays fixed
        setPan(p => ({
          x: mx - ratio * (mx - p.x),
          y: my - ratio * (my - p.y),
        }))
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Pan with mouse drag
  const handleMouseDown = useCallback((e) => {
    const p = pan || { x: 40, y: 20 }
    if (e.button === 1) {
      e.preventDefault()
      setDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY, panX: p.x, panY: p.y }
      return
    }
    if (e.button !== 0) return
    if (e.target.tagName === 'IMG') return
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, panX: p.x, panY: p.y }
  }, [pan])

  const handleMouseMove = useCallback((e) => {
    if (!dragging) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy })
  }, [dragging])

  const handleMouseUp = useCallback(() => setDragging(false), [])

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, handleMouseMove, handleMouseUp])

  // Calculate board layout positions
  const totalCols = 3 + depts.length
  const boardW = B_SHOT_W + B_REF_W + B_DESC_W + depts.length * B_CELL_W + (totalCols - 1) * B_GAP + 60
  let currentY = 0

  const rowPositions = []
  for (const [seq, seqItems] of sequences) {
    rowPositions.push({ type: 'seq', seq, y: currentY, count: seqItems.length })
    currentY += B_SEQ_H + B_GAP
    for (const item of seqItems) {
      const cellH = computeRowH(item, imageMap, depts)
      rowPositions.push({ type: 'shot', shot: item, y: currentY, cellH })
      currentY += cellH + B_GAP
    }
    currentY += 10 // extra gap between sequences
  }
  const boardH = currentY + 60

  const colX = (i) => {
    const widths = [B_SHOT_W, B_REF_W, B_DESC_W, ...depts.map(() => B_CELL_W)]
    let x = 30
    for (let c = 0; c < i; c++) x += widths[c] + B_GAP
    return x
  }

  const colWidths = [B_SHOT_W, B_REF_W, B_DESC_W, ...depts.map(() => B_CELL_W)]

  // Center board horizontally on first render
  const centerPan = useCallback(() => {
    const el = containerRef.current
    if (!el) return { x: 40, y: 20 }
    const containerW = el.clientWidth
    const scaledW = boardW * scale
    const x = Math.max(20, (containerW - scaledW) / 2)
    return { x, y: 20 }
  }, [boardW, scale])

  // Auto-center on mount
  useEffect(() => {
    if (pan === null) {
      // Small delay to ensure container is measured
      requestAnimationFrame(() => setPan(centerPan()))
    }
  }, [pan, centerPan])

  const activePan = pan || { x: 40, y: 20 }

  const resetView = useCallback(() => {
    setScale(0.55)
    // Delay reset pan to after scale updates
    setTimeout(() => {
      const el = containerRef.current
      if (!el) return setPan({ x: 40, y: 20 })
      const containerW = el.clientWidth
      const scaledW = boardW * 0.55
      setPan({ x: Math.max(20, (containerW - scaledW) / 2), y: 20 })
    }, 0)
  }, [boardW])

  return (
    <div ref={containerRef} onMouseDown={handleMouseDown} onAuxClick={e => e.preventDefault()}
      onDragOver={funMode ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropHighlight(true) } : undefined}
      onDragLeave={funMode ? () => setDropHighlight(false) : undefined}
      onDrop={funMode ? (e) => {
        e.preventDefault(); setDropHighlight(false)
        const file = e.dataTransfer.files?.[0]
        if (!file || !file.type.startsWith('image/')) return
        // Convert screen coords to board coords
        const rect = containerRef.current.getBoundingClientRect()
        const ap = pan || { x: 40, y: 20 }
        const boardX = (e.clientX - rect.left - ap.x) / scale
        const boardY = (e.clientY - rect.top - ap.y) / scale
        onStickerDrop(file, Math.round(boardX - 100), Math.round(boardY - 100))
      } : undefined}
      style={{
        flex: 1, overflow: 'hidden', position: 'relative',
        cursor: dragging ? 'grabbing' : 'grab',
        background: dropHighlight ? '#FEF3C7' : '#E8ECF1',
        backgroundImage: dropHighlight ? 'none' : 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        transition: 'background 0.2s',
      }}>

      {/* Zoom controls */}
      <div style={{ position: 'absolute', bottom: 16, right: 16, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button onClick={() => setScale(s => Math.min(5, s * 1.2))} style={zoomBtnStyle}>+</button>
        <button onClick={() => setScale(0.55)} style={{ ...zoomBtnStyle, fontSize: 10, fontWeight: 600 }}>{Math.round(scale * 100)}%</button>
        <button onClick={() => setScale(s => Math.max(0.1, s * 0.8))} style={zoomBtnStyle}>&minus;</button>
        <button onClick={resetView} title="Reset view" style={{ ...zoomBtnStyle, fontSize: 11 }}><IconTarget size={14} /></button>
      </div>

      {/* Transformed board surface */}
      <div style={{
        transformOrigin: '0 0',
        transform: `translate(${activePan.x}px, ${activePan.y}px) scale(${scale})`,
        width: boardW, height: boardH,
        position: 'absolute', top: 0, left: 0,
      }}>
        {/* Column headers */}
        {DEPT_LABELS.map((label, i) => (
          <div key={i} style={{
            position: 'absolute', left: colX(i), top: 0,
            width: colWidths[i], height: B_HDR_H,
            background: '#fff', borderRadius: 10, border: '1px solid #D5DAE1',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 14, fontWeight: 600, color: '#475569',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            {DEPT_COLORS[i] && <div style={{ width: 10, height: 10, borderRadius: '50%', background: DEPT_COLORS[i] }} />}
            {label}
          </div>
        ))}

        {/* Rows */}
        {rowPositions.map((row, ri) => {
          const y = row.y + B_HDR_H + B_GAP
          if (row.type === 'seq') {
            return (
              <div key={`seq-${ri}`} style={{
                position: 'absolute', left: 30, top: y,
                width: boardW - 60, height: B_SEQ_H,
                background: '#F1F5F9', borderRadius: 8,
                display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10,
                borderLeft: `4px solid ${ACCENT}`,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#475569', letterSpacing: 0.5 }}>{row.seq}</span>
                <span style={{ fontSize: 11, color: '#94A3B8', background: '#E2E8F0', borderRadius: 10, padding: '1px 10px', fontWeight: 500 }}>{row.count}</span>
              </div>
            )
          }

          const { shot: item, cellH } = row
          const code = getCode(item)
          const description = getDescription(item)
          return (
            <div key={item.id} style={{ position: 'absolute', left: 0, top: y, width: boardW, height: cellH, overflow: 'hidden' }}>
              {/* Item code */}
              <div style={{
                position: 'absolute', left: colX(0), top: 0,
                width: B_SHOT_W, height: cellH,
                background: '#fff', borderRadius: 10, border: '1px solid #E8ECF1',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', textAlign: 'center' }}>{code}</span>
                <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
                  {depts.map(d => {
                    const st = getShotStatus(getDeptStatus(item, d.id))
                    return <div key={d.id} style={{ width: 16, height: 5, borderRadius: 3, background: st.color, opacity: 0.7 }} title={`${d.label}: ${st.label}`} />
                  })}
                </div>
              </div>

              {/* Reference */}
              <div style={{ position: 'absolute', left: colX(1), top: 0, width: B_REF_W, height: cellH, overflow: 'hidden' }}>
                <RefCell url={getRefUrl(item)} onClick={() => openRef(item)} cellH={cellH} />
              </div>

              {/* Description */}
              <div style={{
                position: 'absolute', left: colX(2), top: 0,
                width: B_DESC_W, height: cellH,
                background: '#fff', borderRadius: 10, border: '1px solid #E8ECF1',
                padding: '12px 14px', overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              }}>
                {description ? (
                  <span style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{description}</span>
                ) : (
                  <span style={{ fontSize: 12, color: '#C8CDD4', fontStyle: 'italic' }}>Nessuna descrizione</span>
                )}
              </div>

              {/* Dept cells */}
              {depts.map((d, di) => {
                const key = `${item.id}__${d.id}`
                const imgs = imageMap[key] || []
                const status = getDeptStatus(item, d.id) || 'not_started'
                const deptDisabled = getDeptDisabled ? getDeptDisabled(item, d.id) : false
                return (
                  <div key={d.id} style={{ position: 'absolute', left: colX(3 + di), top: 0, width: B_CELL_W, height: cellH }}>
                    <BoardCell images={imgs} status={status} cellH={cellH} disabled={deptDisabled}
                      onClickImage={(idx) => openCellImage(item.id, code, d.id, d.label, status, idx)} />
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Sticker layer */}
        {funMode && stickers.map(sticker => (
          <StickerItem key={sticker.id} sticker={sticker} scale={scale}
            onUpdate={(u) => onStickerUpdate(sticker.id, u)}
            onDelete={() => onStickerDelete(sticker.id)} />
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
// STICKER ITEM — draggable, resizable, rotatable
// ══════════════════════════════════════════════════

function StickerItem({ sticker, scale, onUpdate, onDelete }) {
  const [selected, setSelected] = useState(false)
  const [action, setAction] = useState(null) // 'drag' | 'resize_XX' | 'rotate'
  const startRef = useRef(null)
  const elRef = useRef(null)
  const latestRef = useRef(sticker)
  latestRef.current = sticker

  const beginDrag = (e) => {
    e.stopPropagation(); e.preventDefault(); setSelected(true)
    const s = latestRef.current
    startRef.current = { mx: e.clientX, my: e.clientY, x: s.x, y: s.y, w: s.w, h: s.h }
    setAction('drag')
  }

  const beginResize = (e, corner) => {
    e.stopPropagation(); e.preventDefault()
    const s = latestRef.current
    const aspect = s.w / Math.max(s.h, 1)
    startRef.current = { corner, mx: e.clientX, my: e.clientY, x: s.x, y: s.y, w: s.w, h: s.h, aspect }
    setAction('resize')
  }

  const beginRotate = (e) => {
    e.stopPropagation(); e.preventDefault()
    if (!elRef.current) return
    const rect = elRef.current.getBoundingClientRect()
    startRef.current = { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 }
    setAction('rotate')
  }

  useEffect(() => {
    if (!action) return
    const onMove = (e) => {
      const st = startRef.current; if (!st) return
      if (action === 'drag') {
        const dx = (e.clientX - st.mx) / scale, dy = (e.clientY - st.my) / scale
        onUpdate({ x: Math.round(st.x + dx), y: Math.round(st.y + dy) })
      } else if (action === 'resize') {
        const dx = (e.clientX - st.mx) / scale, dy = (e.clientY - st.my) / scale
        const c = st.corner, ar = st.aspect || 1
        let nx = st.x, ny = st.y, nw = st.w, nh = st.h
        if (c === 'br') { nw = st.w + dx; nh = nw / ar }
        else if (c === 'bl') { nw = st.w - dx; nh = nw / ar; nx = st.x + st.w - nw }
        else if (c === 'tr') { nw = st.w + dx; nh = nw / ar; ny = st.y + st.h - nh }
        else if (c === 'tl') { nw = st.w - dx; nh = nw / ar; nx = st.x + st.w - nw; ny = st.y + st.h - nh }
        nw = Math.max(40, nw); nh = Math.max(40, nh)
        onUpdate({ x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) })
      } else if (action === 'rotate') {
        const deg = Math.round(Math.atan2(e.clientY - st.cy, e.clientX - st.cx) * (180 / Math.PI) + 90)
        onUpdate({ rotation: deg })
      }
    }
    const onUp = () => setAction(null)
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [action, scale, onUpdate])

  // Deselect on click outside
  useEffect(() => {
    if (!selected) return
    const onClick = (e) => { if (elRef.current && !elRef.current.contains(e.target)) setSelected(false) }
    window.addEventListener('mousedown', onClick)
    return () => window.removeEventListener('mousedown', onClick)
  }, [selected])

  const show = selected // always show handles when selected

  return (
    <div ref={elRef}
      onMouseDown={beginDrag}
      style={{
        position: 'absolute', left: sticker.x, top: sticker.y, width: sticker.w, height: sticker.h,
        transform: `rotate(${sticker.rotation || 0}deg)`,
        cursor: action === 'drag' ? 'grabbing' : 'grab',
        zIndex: 1000 + (sticker.z_index || 0),
        outline: show ? '2px solid #F28C28' : 'none',
        borderRadius: 4,
      }}>
      <img src={cld(sticker.image_url, { w: 600, h: 600, fit: 'limit' })} alt="" draggable={false}
        style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }} />

      {show && <>
        {/* Delete */}
        <button onMouseDown={e => { e.stopPropagation(); onDelete() }} style={{
          position: 'absolute', top: -14, right: -14, width: 28, height: 28, borderRadius: '50%',
          background: '#EF4444', border: '2px solid #fff', color: '#fff', fontSize: 14,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)', zIndex: 10,
        }}>✕</button>

        {/* Resize corners */}
        {['tl','tr','bl','br'].map(c => (
          <div key={c} onMouseDown={e => beginResize(e, c)} style={{
            position: 'absolute', width: 16, height: 16,
            background: '#fff', border: '2px solid #F28C28', borderRadius: 3,
            cursor: (c === 'tl' || c === 'br') ? 'nwse-resize' : 'nesw-resize',
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)', zIndex: 10,
            ...(c === 'tl' ? { top: -8, left: -8 } : c === 'tr' ? { top: -8, right: -8 } : c === 'bl' ? { bottom: -8, left: -8 } : { bottom: -8, right: -8 }),
          }} />
        ))}

        {/* Rotate handle */}
        <div onMouseDown={beginRotate} style={{
          position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)',
          width: 24, height: 24, borderRadius: '50%',
          background: '#fff', border: '2px solid #10B981',
          cursor: 'crosshair', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12,
        }}>↻</div>
        {/* Line from rotate handle to sticker */}
        <div style={{ position: 'absolute', top: -20, left: '50%', width: 1, height: 20, background: '#10B981', pointerEvents: 'none' }} />
      </>}
    </div>
  )
}

const zoomBtnStyle = {
  width: 36, height: 36, borderRadius: 8, border: '1px solid #D5DAE1',
  background: '#fff', color: '#475569', fontSize: 18, fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
}

// ══════════════════════════════════════════════════
// COMPACT GRID VIEW
// CompactGrid removed — board view only

// ══════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════

export default function StoryboardPage({ shots, assets = [], tasks, profiles, user, currentProject, addToast }) {
  const isMobile = useIsMobile()
  const [wipImages, setWipImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [filterSeq, setFilterSeq] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [lightbox, setLightbox] = useState(null)
  const [funMode, setFunMode] = useState(() => localStorage.getItem('storyboard_fun') === 'true')
  const [stickers, setStickers] = useState([])
  const [uploadingSticker, setUploadingSticker] = useState(false)
  const [activeTab, setActiveTab] = useState('shots')

  const toggleFun = () => {
    const next = !funMode
    setFunMode(next)
    localStorage.setItem('storyboard_fun', next)
  }

  const loadImages = useCallback(async () => {
    if (!currentProject?.id) return
    const data = await getStoryboardImages(currentProject.id)
    const shotIds = new Set((shots || []).map(s => s.id))
    const assetIds = new Set((assets || []).map(a => a.id))
    setWipImages(data.filter(img => (img.shot_id && shotIds.has(img.shot_id)) || (img.asset_id && assetIds.has(img.asset_id))))
    setLoading(false)
  }, [currentProject?.id, shots, assets])

  const busyStickerIds = useRef(new Set()) // IDs currently being manipulated locally

  const loadStickers = useCallback(async () => {
    if (!currentProject?.id) return
    const data = await getStickers(currentProject.id)
    // Merge: don't overwrite stickers that are being actively manipulated
    setStickers(prev => {
      const busy = busyStickerIds.current
      if (busy.size === 0) return data
      // Keep local version of busy stickers, update the rest from DB
      const dbMap = {}; data.forEach(s => { dbMap[s.id] = s })
      const localMap = {}; prev.forEach(s => { localMap[s.id] = s })
      return data.map(s => busy.has(s.id) && localMap[s.id] ? localMap[s.id] : s)
    })
  }, [currentProject?.id])

  useEffect(() => { loadImages() }, [loadImages])
  useEffect(() => { loadStickers() }, [loadStickers])

  useEffect(() => {
    if (!currentProject?.id) return
    const ch1 = supabase.channel('storyboard-wip')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'miro_wip_images' }, () => loadImages())
      .subscribe()
    const ch2 = supabase.channel('storyboard-stickers')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'storyboard_stickers' }, () => loadStickers())
      .subscribe()
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2) }
  }, [currentProject?.id, loadImages, loadStickers])

  // Drop image file onto storyboard to create sticker
  const handleStickerDrop = useCallback(async (file, dropX, dropY) => {
    if (!file || !currentProject?.id || !funMode) return
    setUploadingSticker(true)
    const { url, error } = await uploadStickerImage(currentProject.id, file)
    if (error) { addToast?.('Upload error: ' + error.message, 'danger'); setUploadingSticker(false); return }
    await createSticker({ project_id: currentProject.id, user_id: user.id, image_url: url, x: dropX || 300, y: dropY || 300, w: 200, h: 200, rotation: 0, z_index: stickers.length })
    setUploadingSticker(false)
  }, [currentProject?.id, funMode, user?.id, stickers.length])

  const stickerSaveTimers = useRef({})
  const handleStickerUpdate = useCallback((id, updates) => {
    // Mark as busy so realtime doesn't overwrite
    busyStickerIds.current.add(id)
    // Update local state immediately
    setStickers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    // Debounce DB save — longer delay to batch rapid moves
    if (stickerSaveTimers.current[id]) clearTimeout(stickerSaveTimers.current[id])
    stickerSaveTimers.current[id] = setTimeout(() => {
      updateSticker(id, updates).then(() => {
        // Unmark busy after DB confirms
        busyStickerIds.current.delete(id)
      })
      delete stickerSaveTimers.current[id]
    }, 800)
  }, [])

  const handleStickerDelete = async (id) => {
    setStickers(prev => prev.filter(s => s.id !== id))
    await deleteSticker(id)
  }

  const shotImageMap = useMemo(() => {
    const map = {}
    for (const img of wipImages) {
      if (!img.shot_id) continue
      const key = `${img.shot_id}__${img.department}`
      if (!map[key]) map[key] = []
      map[key].push(img)
    }
    return map
  }, [wipImages])

  const assetImageMap = useMemo(() => {
    const map = {}
    for (const img of wipImages) {
      if (!img.asset_id) continue
      const key = `${img.asset_id}__${img.department}`
      if (!map[key]) map[key] = []
      map[key].push(img)
    }
    return map
  }, [wipImages])

  const allSequences = useMemo(() => [...new Set((shots || []).map(s => s.sequence).filter(Boolean))].sort(), [shots])

  const filteredShots = useMemo(() => {
    let list = shots || []
    if (filterSeq !== 'all') list = list.filter(s => s.sequence === filterSeq)
    if (searchText) { const q = searchText.toLowerCase(); list = list.filter(s => s.code?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)) }
    if (filterStatus !== 'all') list = list.filter(s => SHOT_DEPTS.some(d => s[STATUS_KEY(d.id)] === filterStatus))
    return list
  }, [shots, filterSeq, searchText, filterStatus])

  const filteredAssets = useMemo(() => {
    let list = assets || []
    if (searchText) { const q = searchText.toLowerCase(); list = list.filter(a => a.name?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)) }
    if (filterStatus !== 'all') list = list.filter(a => ASSET_DEPTS.some(d => a[STATUS_KEY(d.id)] === filterStatus))
    return list
  }, [assets, searchText, filterStatus])

  const sequences = useMemo(() => {
    const groups = {}
    for (const shot of filteredShots) { const seq = shot.sequence || 'Unassigned'; if (!groups[seq]) groups[seq] = []; groups[seq].push(shot) }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [filteredShots])

  const assetSequences = useMemo(() => {
    if (filteredAssets.length === 0) return []
    return [['Assets', filteredAssets]]
  }, [filteredAssets])

  const handleNav = useCallback((dir) => {
    setLightbox(prev => { if (!prev) return prev; const len = prev.images.length; return { ...prev, index: (prev.index + dir + len) % len } })
  }, [])

  const openShotCellImage = useCallback((shotId, shotCode, deptId, deptLabel, status, imgIndex) => {
    const imgs = shotImageMap[`${shotId}__${deptId}`]
    if (!imgs?.length) return
    setLightbox({ images: imgs, index: imgIndex, shotCode, deptLabel, statusObj: getShotStatus(status) })
  }, [shotImageMap])

  const openAssetCellImage = useCallback((assetId, assetName, deptId, deptLabel, status, imgIndex) => {
    const imgs = assetImageMap[`${assetId}__${deptId}`]
    if (!imgs?.length) return
    setLightbox({ images: imgs, index: imgIndex, shotCode: assetName, deptLabel, statusObj: getShotStatus(status) })
  }, [assetImageMap])

  const openShotRef = useCallback((shot) => {
    const url = shot.ref_cloud_url || shot.concept_image_url
    if (!url) return
    setLightbox({ images: [{ id: 'ref', image_url: url }], index: 0, shotCode: shot.code, deptLabel: 'Reference', statusObj: null })
  }, [])

  const openAssetRef = useCallback((asset) => {
    const url = asset.ref_cloud_url
    if (!url) return
    setLightbox({ images: [{ id: 'ref', image_url: url }], index: 0, shotCode: asset.name, deptLabel: 'Reference', statusObj: null })
  }, [])

  const totalImages = wipImages.length
  const isShotsTab = activeTab === 'shots'
  const currentCount = isShotsTab ? filteredShots.length : filteredAssets.length
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#E8ECF1' }}>
      {/* Header */}
      <div style={{
        padding: isMobile ? '10px 12px 8px' : '12px 24px 10px',
        background: '#fff', borderBottom: '1px solid #E8ECF1',
        display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, zIndex: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div>
              <h1 style={{ fontSize: isMobile ? 18 : 20, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Storyboard</h1>
              <span style={{ fontSize: 11, color: '#94A3B8' }}>
                {isShotsTab
                  ? <>{filteredShots.length} shot{filteredShots.length !== 1 ? 's' : ''} &middot; {totalImages} immagin{totalImages !== 1 ? 'i' : 'e'}</>
                  : <>{filteredAssets.length} asset{filteredAssets.length !== 1 ? 's' : ''} &middot; {totalImages} immagin{totalImages !== 1 ? 'i' : 'e'}</>}
              </span>
            </div>
            {/* Tab switcher */}
            <div style={{ display: 'inline-flex', background: '#F1F5F9', borderRadius: 999, padding: 3, gap: 2 }}>
              {['shots', 'assets'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: '5px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  background: activeTab === tab ? '#fff' : 'transparent',
                  color: activeTab === tab ? ACCENT : '#64748B',
                  boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}>{tab === 'shots' ? 'Shots' : 'Assets'}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Fun/Serious toggle */}
            <button onClick={toggleFun} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20,
              border: funMode ? '2px solid #F59E0B' : '1px solid #E2E8F0',
              background: funMode ? '#FFFBEB' : '#F8FAFC', fontSize: 12, fontWeight: 600,
              color: funMode ? '#D97706' : '#94A3B8', cursor: 'pointer', transition: 'all 0.2s',
            }}>
              {funMode ? '🎉 Fun' : '📋 Serious'}
            </button>
            {funMode && uploadingSticker && (
              <span style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}>Uploading...</span>
            )}
            <div style={{ position: 'relative', minWidth: isMobile ? 120 : 180 }}>
              <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}><IconSearch size={14} color="#94A3B8" /></div>
              <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder={isShotsTab ? 'Cerca shot...' : 'Cerca asset...'}
                style={{ width: '100%', padding: '6px 10px 6px 30px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, background: '#F8FAFC', outline: 'none' }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {isShotsTab && (<>
            <FilterPill label="Tutti" active={filterSeq === 'all'} onClick={() => setFilterSeq('all')} />
            {allSequences.map(seq => <FilterPill key={seq} label={seq} active={filterSeq === seq} onClick={() => setFilterSeq(seq)} />)}
            <div style={{ width: 1, height: 18, background: '#E2E8F0', margin: '0 4px' }} />
          </>)}
          {SHOT_STATUSES.map(st => <FilterPill key={st.id} label={st.label} active={filterStatus === st.id} onClick={() => setFilterStatus(filterStatus === st.id ? 'all' : st.id)} dotColor={st.color} />)}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14 }}>Caricamento...</div>
      ) : currentCount === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 14 }}>
          {isShotsTab ? 'Nessuno shot trovato' : 'Nessun asset trovato'}
        </div>
      ) : isShotsTab ? (
        <CanvasBoard
          sequences={sequences} imageMap={shotImageMap} depts={SHOT_DEPTS}
          getCode={s => s.code}
          getRefUrl={s => s.ref_cloud_url || s.concept_image_url}
          getDescription={s => s.description}
          getDeptStatus={(s, dId) => s[STATUS_KEY(dId)]}
          getDeptDisabled={(s, dId) => !isDeptEnabled(s, dId)}
          openCellImage={openShotCellImage} openRef={openShotRef}
          funMode={funMode} stickers={stickers}
          onStickerUpdate={handleStickerUpdate} onStickerDelete={handleStickerDelete} onStickerDrop={handleStickerDrop} />
      ) : (
        <CanvasBoard
          sequences={assetSequences} imageMap={assetImageMap} depts={ASSET_DEPTS}
          getCode={a => a.name}
          getRefUrl={a => a.ref_cloud_url}
          getDescription={a => a.description}
          getDeptStatus={(a, dId) => a[STATUS_KEY(dId)]}
          openCellImage={openAssetCellImage} openRef={openAssetRef}
          funMode={false} stickers={[]}
          onStickerUpdate={() => {}} onStickerDelete={() => {}} onStickerDrop={() => {}} />
      )}

      {lightbox && <GalleryLightbox images={lightbox.images} index={lightbox.index} shotCode={lightbox.shotCode} deptLabel={lightbox.deptLabel} statusObj={lightbox.statusObj} onClose={() => setLightbox(null)} onNav={handleNav} />}
    </div>
  )
}

function FilterPill({ label, active, onClick, dotColor }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '4px 12px', borderRadius: 20,
        border: active ? `1.5px solid ${ACCENT}` : '1px solid #E2E8F0',
        background: active ? 'rgba(242,140,40,0.08)' : hov ? '#F8FAFC' : '#fff',
        color: active ? ACCENT : '#475569',
        fontSize: 12, fontWeight: active ? 600 : 500,
        cursor: 'pointer', transition: 'all 0.12s ease', whiteSpace: 'nowrap',
      }}>
      {dotColor && <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor }} />}
      {label}
    </button>
  )
}
