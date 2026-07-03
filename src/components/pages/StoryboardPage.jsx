import { useState, useEffect, useMemo, useCallback, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import { SHOT_DEPTS, ASSET_DEPTS, SHOT_STATUSES, TASK_STATUSES, getShotStatus, getTaskStatus, ACCENT, isDeptEnabled, isAudioUrl } from '../../lib/constants'
import { supabase, getStoryboardImages, getStickers, createSticker, updateSticker, deleteSticker, uploadStickerImage } from '../../lib/supabase'
import useIsMobile from '../../hooks/useIsMobile'
import { IconX, IconSearch, IconLayout, IconTarget } from '../ui/Icons'
import { cld } from '../../lib/cld'
import Img from '../ui/Img'
import { thumbUrlFor, THUMB_MAX_EDGE } from '../../lib/thumbs'

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

// R2 serves images at their stored size (Cloudinary removed — no on-the-fly
// resize). Passthrough kept so call sites stay unchanged.
function thumbUrl(url) {
  return url || null
}

// DOM-based wrap measurement. Uses a hidden div with the exact same font/lineHeight/wrap
// styles as the rendered description so offsetHeight matches the browser pixel-for-pixel.
// The app uses Poppins (Google Fonts, deferred load) on the body — using a different
// cascade here would silently mis-measure because Poppins is wider than the fallback.
const DESC_FONT_FAMILY = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

let _measureEl = null
function getMeasureEl() {
  if (_measureEl && _measureEl.isConnected) return _measureEl
  if (typeof document === 'undefined' || !document.body) return null
  const el = document.createElement('div')
  Object.assign(el.style, {
    position: 'absolute', visibility: 'hidden', pointerEvents: 'none',
    left: '-99999px', top: '-99999px',
    margin: '0', border: '0', padding: '0',
    fontFamily: DESC_FONT_FAMILY,
    fontWeight: '400',
    whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word',
    boxSizing: 'content-box',
  })
  document.body.appendChild(el)
  _measureEl = el
  return el
}

// padV = vertical padding of the description box (12 top + 12 bottom = 24)
function measureDescH(text, maxW, fontSize = 12, lineHeight = 1.5, padV = 24) {
  if (!text) return padV + Math.ceil(fontSize * lineHeight)
  const el = getMeasureEl()
  if (!el) {
    return padV + Math.ceil(String(text).length / 32) * Math.ceil(fontSize * lineHeight)
  }
  el.style.width = maxW + 'px'
  el.style.fontSize = fontSize + 'px'
  el.style.lineHeight = String(lineHeight)
  el.textContent = String(text)
  return el.offsetHeight + padV
}

// ══════════════════════════════════════════════════
// LIGHTBOX
// ══════════════════════════════════════════════════

// Lightbox sources at two tiers:
//  - LIGHTBOX_BASE_W: initial paint. Big enough that at scale 1 the image is
//    sharp on a 4K display (a 16:9 image rendered at 88vw on a 3840px-wide
//    screen needs ~3380 source px to hit 1:1; we round up).
//  - LIGHTBOX_HD_W: requested once the user starts zooming past 1×. Cloudinary
//    caps at the original size (fit=limit), so this just unlocks whatever
//    headroom the source has.
const LIGHTBOX_BASE_W = 3840
const LIGHTBOX_HD_W = 8000
const HD_ZOOM_THRESHOLD = 1.05
const MAX_ZOOM = 40

function GalleryLightbox({ images, index, shotCode, deptLabel, statusObj, onClose, onNav }) {
  // Pan/zoom transform held in a ref and applied imperatively to the stage so
  // wheel-zoom and right-click pan don't trigger React re-renders during the
  // gesture (same pattern as ImageAnnotator). Reset whenever the image changes.
  const wrapRef = useRef(null)
  const stageRef = useRef(null)
  const xformRef = useRef({ scale: 1, panX: 0, panY: 0 })
  const panningRef = useRef(null)
  const [zoomLabel, setZoomLabel] = useState(1)
  // Swap to a much larger Cloudinary derivation once the user starts zooming.
  // Stays on per-image until the image changes, so panning around at high
  // zoom doesn't yo-yo back to the small source.
  const [hd, setHd] = useState(false)
  const [hdLoaded, setHdLoaded] = useState(false)

  const applyXform = useCallback(() => {
    const el = stageRef.current
    if (!el) return
    const { scale, panX, panY } = xformRef.current
    el.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`
  }, [])

  const resetZoom = useCallback(() => {
    xformRef.current = { scale: 1, panX: 0, panY: 0 }
    applyXform()
    setZoomLabel(1)
  }, [applyXform])

  // Reset view + HD state whenever the active image changes (nav or initial open).
  useEffect(() => {
    resetZoom()
    setHd(false)
    setHdLoaded(false)
  }, [index, resetZoom])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onNav(1)
      if (e.key === 'ArrowLeft') onNav(-1)
      if (e.key === '0') resetZoom()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, onNav, resetZoom])

  // Wheel zoom anchored to the cursor. Non-passive so we can preventDefault
  // (React's default wheel listener is passive).
  const onWheel = useCallback((e) => {
    if (!wrapRef.current) return
    e.preventDefault()
    const wrap = wrapRef.current.getBoundingClientRect()
    const cx = e.clientX - wrap.left
    const cy = e.clientY - wrap.top
    const cur = xformRef.current
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const nextScale = Math.max(0.2, Math.min(MAX_ZOOM, cur.scale * factor))
    if (nextScale === cur.scale) return
    const k = nextScale / cur.scale
    const nextPanX = cx - (cx - cur.panX) * k
    const nextPanY = cy - (cy - cur.panY) * k
    xformRef.current = { scale: nextScale, panX: nextPanX, panY: nextPanY }
    applyXform()
    setZoomLabel(nextScale)
    if (nextScale > HD_ZOOM_THRESHOLD) setHd(true)
  }, [applyXform])
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const handler = (e) => onWheel(e)
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [onWheel])

  const onPointerDown = (e) => {
    // Right-button OR middle-button → pan. Left-click on the dark backdrop
    // still closes (via the outer onClick), left-click on the image is a no-op.
    if (e.button === 2 || e.button === 1) {
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      const cur = xformRef.current
      panningRef.current = {
        startX: e.clientX, startY: e.clientY,
        originPanX: cur.panX, originPanY: cur.panY,
      }
    }
  }
  const onPointerMove = (e) => {
    if (!panningRef.current) return
    const p = panningRef.current
    xformRef.current = {
      ...xformRef.current,
      panX: p.originPanX + (e.clientX - p.startX),
      panY: p.originPanY + (e.clientY - p.startY),
    }
    applyXform()
  }
  const onPointerUp = () => { panningRef.current = null }

  if (!images?.length) return null
  const img = images[index] || images[0]
  const audio = isAudioUrl(img.image_url)

  // Download the original asset. R2/Cloudinary are cross-origin and don't send
  // Content-Disposition, so a direct <a download> just opens the image in a
  // tab. We route through our own /api/download proxy which re-serves the file
  // same-origin with an attachment disposition, so the download starts directly
  // without opening any extra tab.
  const downloadCurrent = (e) => {
    e.stopPropagation()
    const url = img.image_url
    const clean = url.split('?')[0]
    const ext = (clean.match(/\.([a-z0-9]+)$/i)?.[1] || 'jpg').toLowerCase()
    const base = [shotCode, deptLabel].filter(Boolean).join('_').replace(/[^\w.-]+/g, '_') || 'storyboard'
    const filename = `${base}.${ext}`
    const a = document.createElement('a')
    a.href = `/api/download?url=${encodeURIComponent(url)}&name=${encodeURIComponent(filename)}`
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.15s ease',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px', cursor: 'default',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>{shotCode}</span>
          {deptLabel && <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20 }}>{deptLabel}</span>}
          {statusObj && <span style={{ background: statusObj.bg, color: statusObj.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20 }}>{statusObj.label}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!audio && (
            <>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, fontFamily: 'monospace' }}>{Math.round(zoomLabel * 100)}%</span>
              {hd && (
                <span title={hdLoaded ? 'Sorgente alta risoluzione' : 'Carico alta risoluzione...'} style={{
                  background: hdLoaded ? 'rgba(80,200,120,0.18)' : 'rgba(255,255,255,0.1)',
                  color: hdLoaded ? '#9be7b1' : 'rgba(255,255,255,0.7)',
                  fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 6, letterSpacing: 0.5,
                }}>HD{hdLoaded ? '' : '…'}</span>
              )}
              <button onClick={resetZoom} title="Reset zoom (0)" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 18, padding: '6px 12px', cursor: 'pointer', color: '#fff', fontSize: 12, fontWeight: 600 }}>1:1</button>
            </>
          )}
          {images.length > 1 && <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{index + 1} / {images.length}</span>}
          <button onClick={downloadCurrent} title="Scarica" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}><IconX size={18} /></button>
        </div>
      </div>
      {audio ? (
        <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, padding: '24px 32px', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 8px 60px rgba(0,0,0,0.5)' }}>
          <span style={{ fontSize: 32 }}>&#9835;</span>
          <audio controls src={img.image_url} autoPlay style={{ minWidth: 300 }} />
        </div>
      ) : (
        <div
          ref={wrapRef}
          onClick={e => e.stopPropagation()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', touchAction: 'none',
            cursor: panningRef.current ? 'grabbing' : 'default',
          }}
        >
          <div
            ref={stageRef}
            style={{
              transformOrigin: '0 0',
              willChange: 'transform',
              display: 'inline-block',
              lineHeight: 0,
            }}
          >
            <Img
              src={img.image_url}
              w={hd ? LIGHTBOX_HD_W : LIGHTBOX_BASE_W}
              h={hd ? LIGHTBOX_HD_W : LIGHTBOX_BASE_W}
              fit="limit" alt=""
              loading="eager"
              draggable={false}
              onLoad={() => { if (hd) setHdLoaded(true) }}
              style={{
                maxWidth: '88vw', maxHeight: '80vh',
                borderRadius: 6, objectFit: 'contain', display: 'block',
                boxShadow: '0 8px 60px rgba(0,0,0,0.5)',
                userSelect: 'none', pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      )}
      {/* Hint: how to use the zoom/pan — only when image is shown */}
      {!audio && (
        <div onClick={e => e.stopPropagation()} style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
          color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 500,
          padding: '6px 14px', borderRadius: 999, pointerEvents: 'none', zIndex: 2,
          letterSpacing: 0.2,
        }}>
          Rotella per zoomare (fino a {MAX_ZOOM}00%) · Tasto destro per spostare · 0 per reset
        </div>
      )}
      {images.length > 1 && <>
        <button onClick={e => { e.stopPropagation(); onNav(-1) }} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 24, fontWeight: 700, backdropFilter: 'blur(4px)', zIndex: 2 }}>&lsaquo;</button>
        <button onClick={e => { e.stopPropagation(); onNav(1) }} style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 24, fontWeight: 700, backdropFilter: 'blur(4px)', zIndex: 2 }}>&rsaquo;</button>
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

// Minimum thumbnail width inside a multi-image cell. Below this we don't shrink —
// the cell grows vertically instead (so 12 concept sketches end up as a taller
// masonry stack, not a postage-stamp grid).
const MASONRY_MIN_IMG_W = 120
const MASONRY_GAP = 6
const MASONRY_PAD = 4

// Pick a column count that respects MASONRY_MIN_IMG_W and the cell's width
// budget, but also aims for a roughly square layout. Without the √count cap the
// masonry only used as many columns as the width budget strictly required (2 at
// this width), so a 9-image cell became a 2-wide × 5-tall tower. Capping at
// ceil(√count) keeps it balanced (9 → 3×3) while `fit` still prevents columns
// from getting narrower than MASONRY_MIN_IMG_W.
function cellColumns(count) {
  if (count <= 1) return 1
  const budget = B_CELL_W - 2 * MASONRY_PAD + MASONRY_GAP
  const fit = Math.floor(budget / (MASONRY_MIN_IMG_W + MASONRY_GAP))
  const balanced = Math.ceil(Math.sqrt(count))
  return Math.max(2, Math.min(count, Math.max(1, fit), balanced))
}

// Synthetic initial height for a masonry cell, used until ResizeObserver
// reports the real laid-out height. Assumes ~square aspect — biased a bit tall
// so the first paint doesn't clip portrait imagery before the measurement
// pass kicks in.
function estimateCellH(count) {
  if (count <= 1) return 240
  const cols = cellColumns(count)
  const colW = (B_CELL_W - 2 * MASONRY_PAD - (cols - 1) * MASONRY_GAP) / cols
  const perCol = Math.ceil(count / cols)
  return Math.ceil(perCol * (colW + MASONRY_GAP) - MASONRY_GAP + 2 * MASONRY_PAD)
}

// First-paint guess for a single full-width image (aspect unknown until it
// loads). Biased slightly tall so portrait art isn't clipped before the
// ResizeObserver reports the real height.
function estimateSingleH() {
  return Math.round((B_CELL_W - 2 * MASONRY_PAD) * 0.7) + 2 * MASONRY_PAD
}

// Board image that loads progressively: it paints the tiny R2 thumb sibling
// immediately (instant board, even with hundreds of images) and only fetches
// the full-res original once `highRes` is true — i.e. the cell is both visible
// AND zoomed in past the thumb's resolution. The swap is flicker-free (the thumb
// stays until the original has decoded). If a thumb is missing (older image not
// yet backfilled), it transparently falls back to the original. The thumb keeps
// the original's aspect ratio, so row-height measurement is correct before any
// upgrade.
const ProgressiveImg = memo(function ProgressiveImg({ original, highRes, onClick, style }) {
  const thumb = useMemo(() => thumbUrlFor(original), [original])
  const hasThumb = thumb !== original

  // { src: rendered url, full: showing original?, bust: retry count, failed }
  const [st, setSt] = useState(() => ({ src: hasThumb ? thumb : original, full: !hasThumb, bust: 0, failed: false }))

  // Reset when the underlying image changes (e.g. a cell swaps its image).
  useEffect(() => {
    setSt({ src: hasThumb ? thumb : original, full: !hasThumb, bust: 0, failed: false })
  }, [original, thumb, hasThumb])

  // Upgrade to full-res when zoomed in. Preload first so the thumb stays on
  // screen until the original is decoded — no flash of blank/low-res swap.
  useEffect(() => {
    if (!highRes || st.full) return
    let cancelled = false
    const pre = new Image()
    pre.onload = () => { if (!cancelled) setSt(s => (s.full ? s : { ...s, src: original, full: true })) }
    pre.src = original
    return () => { cancelled = true }
  }, [highRes, st.full, original])

  const onError = useCallback(() => {
    setSt(s => {
      if (!s.full) return { src: original, full: true, bust: 0, failed: false } // thumb missing → original
      if (s.bust < 2) { const b = s.bust + 1; return { ...s, src: `${original}${original.includes('?') ? '&' : '?'}_r=${b}`, bust: b } }
      return { ...s, failed: true }
    })
  }, [original])

  if (st.failed) return <div role="img" aria-label="" style={{ background: '#E2E8F0', ...style }} />
  return (
    <img src={st.src} alt="" onClick={onClick} onError={onError}
      draggable={false} onDragStart={(e) => e.preventDefault()}
      decoding="async" loading="lazy" style={style} />
  )
})

const BoardCell = memo(function BoardCell({ images, status, onClickImage, cellH, disabled, measureRef, highRes }) {
  const count = images?.length || 0

  if (disabled) return <div style={{ height: cellH }} />

  if (count === 0) return <div style={{ height: cellH }} />

  if (count === 1) {
    if (isAudioUrl(images[0].image_url)) return (
      <div style={{ height: cellH, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box' }}>
        <AudioMiniPlayer url={images[0].image_url} />
      </div>
    )
    // Single image fills the column width and keeps its natural aspect — no fixed
    // box, so it's never cropped and never letterboxed (the contain box used to
    // leave the board's grey background showing around portrait art). Its
    // measured height drives the row via ResizeObserver.
    return (
      <div style={{ padding: MASONRY_PAD, boxSizing: 'border-box' }}>
        <div ref={measureRef} style={{ lineHeight: 0 }}>
          <ProgressiveImg original={images[0].image_url} highRes={highRes} onClick={() => onClickImage(0)}
            style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 6, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', userSelect: 'none', WebkitUserDrag: 'none' }} />
        </div>
      </div>
    )
  }

  // Masonry: CSS multi-column with break-inside: avoid. Each image keeps its
  // natural aspect (width:100% of column, height:auto) so we never letterbox or
  // crop — and columns balance automatically, killing the dead-cell gaps the old
  // fixed 2×N grid produced for odd image counts.
  const cols = cellColumns(count)
  return (
    <div style={{ minHeight: cellH, padding: MASONRY_PAD, boxSizing: 'border-box' }}>
      <div ref={measureRef} style={{ columnCount: cols, columnGap: MASONRY_GAP }}>
        {images.map((img, i) => (
          <div key={img.id} style={{ breakInside: 'avoid', WebkitColumnBreakInside: 'avoid', pageBreakInside: 'avoid', marginBottom: MASONRY_GAP, lineHeight: 0 }}>
            {isAudioUrl(img.image_url) ? (
              <AudioMiniPlayer url={img.image_url} />
            ) : (
              <ProgressiveImg original={img.image_url} highRes={highRes} onClick={() => onClickImage(i)}
                style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 5, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', userSelect: 'none', WebkitUserDrag: 'none' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
})

// Passthrough (Cloudinary removed — R2 has no on-the-fly resize).
function refThumbUrl(url) {
  return url || null
}

const RefCell = memo(function RefCell({ url, onClick, cellH, highRes }) {
  const [hov, setHov] = useState(false)
  if (!url) return <div style={{ height: cellH }} />
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ height: cellH, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', border: '1px solid #E8ECF1', background: '#fff', transition: 'all 0.15s ease', transform: hov ? 'translateY(-1px)' : 'none', boxShadow: hov ? '0 6px 20px rgba(0,0,0,0.12)' : '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <ProgressiveImg original={url} highRes={highRes}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', userSelect: 'none', WebkitUserDrag: 'none' }} />
    </div>
  )
})

// Row height: base 240px, grows to fit multi-image grids AND the full description text.
// `descHeights[item.id]` is the *measured* natural height of the rendered description block
// from a ResizeObserver — this is the source of truth once the description has rendered.
// Until then we fall back to a synthetic measurement so the first paint is approximately right.
const DESC_PAD_V = 24 // 12px top + 12px bottom on the description box
function computeRowH(item, imageMap, depts, description, descHeights, cellHeights) {
  const BASE = 240
  let maxGridH = 0

  for (const d of depts) {
    const imgs = imageMap[`${item.id}__${d.id}`] || []
    if (imgs.length === 0) continue
    // A lone audio clip renders a fixed mini-player, not a full-width image, so
    // it shouldn't stretch the row — let it ride the BASE height.
    if (imgs.length === 1 && isAudioUrl(imgs[0].image_url)) continue
    // Prefer the measured cell height from ResizeObserver. Both the single
    // full-width image and the multi-image masonry report their real laid-out
    // height; the synthetic estimates are just first-paint placeholders, biased
    // tall so portrait imagery doesn't get clipped before measurement lands.
    const observed = cellHeights?.[`${item.id}__${d.id}`]
    const gridH = observed != null
      ? observed + 2 * MASONRY_PAD
      : (imgs.length === 1 ? estimateSingleH() : estimateCellH(imgs.length))
    maxGridH = Math.max(maxGridH, gridH)
  }

  const observed = descHeights?.[item.id]
  const descH = observed != null
    ? Math.ceil(observed) + DESC_PAD_V + 8
    : measureDescH(description, B_DESC_W - 28) + 8

  return Math.max(BASE, maxGridH, descH)
}

// ══════════════════════════════════════════════════
// CANVAS / BOARD VIEW — pan & zoom whiteboard
// ══════════════════════════════════════════════════

// Tool palette definition. Shortcuts intentionally mirror Figma/Miro defaults.
// Hotkey assignments are deliberately scoped to tools the user reaches by
// keyboard often (selection, hand, drawing). Shape tools (rect/ellipse/arrow)
// stay click-only — their keys (R/O/A/L) were never used in practice and were
// stepping on shortcuts that matter (E for eraser etc.). Shortcuts work the
// same on Mac and Windows; modifier handling below uses ctrlKey || metaKey so
// Cmd on macOS behaves identically to Ctrl on Windows.
const TOOLS = [
  { id: 'select',  label: 'Seleziona',  shortcut: 'V' },
  { id: 'hand',    label: 'Mano',       shortcut: 'H' },
  { id: 'text',    label: 'Testo',      shortcut: 'T' },
  { id: 'rect',    label: 'Rettangolo' },
  { id: 'ellipse', label: 'Ellisse' },
  { id: 'arrow',   label: 'Freccia' },
  { id: 'pen',     label: 'Pennarello', shortcut: 'B' },
  { id: 'eraser',  label: 'Gomma',      shortcut: 'E' },
  { id: 'strokemove', label: 'Sposta disegno', shortcut: 'W' },
]

function ToolIcon({ id, active }) {
  const stroke = active ? '#fff' : '#475569'
  const sw = 2
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke, strokeWidth: sw, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (id) {
    case 'select':  return <svg {...common}><path d="M5 3l14 8-6 1-3 7L5 3z" /></svg>
    case 'hand':    return <svg {...common}><path d="M9 11V4.5a1.5 1.5 0 0 1 3 0V11" /><path d="M12 11V3.5a1.5 1.5 0 0 1 3 0V11" /><path d="M15 11V4.5a1.5 1.5 0 0 1 3 0V13" /><path d="M6 13.5V8.5a1.5 1.5 0 0 1 3 0V14" /><path d="M18 13c0 5-3 8-6 8-4 0-6-3-6-6v-1.5" /></svg>
    case 'text':    return <svg {...common}><path d="M4 5h16" /><path d="M12 5v15" /><path d="M9 20h6" /></svg>
    case 'rect':    return <svg {...common}><rect x="4" y="6" width="16" height="12" rx="1.5" /></svg>
    case 'ellipse': return <svg {...common}><ellipse cx="12" cy="12" rx="8" ry="6" /></svg>
    case 'arrow':   return <svg {...common}><path d="M4 12h15" /><path d="M14 6l5 6-5 6" /></svg>
    case 'image':   return <svg {...common}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M5 19l5-5 4 4 3-3 3 3" /></svg>
    case 'pen':     return <svg {...common}><path d="M3 21l3-1 11-11-2-2L4 18l-1 3z" /><path d="M14 7l3 3" /></svg>
    // Eraser — Lucide-style: angled rubber block with a baseline so it doesn't
    // get confused with the pen (which has the same diagonal axis). The bottom
    // horizontal line is the floor that gives the icon a clear "rubber" identity.
    case 'eraser':  return <svg {...common}><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
    // Sposta-disegno — dashed selection rect + 4-direction move arrows.
    case 'strokemove': return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="1.5" strokeDasharray="3 2"/><path d="M12 9v6"/><path d="M9 12h6"/><path d="m10.5 10.5-1.5 1.5 1.5 1.5"/><path d="m13.5 10.5 1.5 1.5-1.5 1.5"/></svg>
    default: return null
  }
}

function CanvasBoard({ sequences, imageMap, depts, getCode, getRefUrl, getDescription, getDeptStatus, getDeptDisabled, getTasks, openCellImage, openRef, creativeMode, stickers, autoEditId, onStickerUpdate, onStickerDelete, onBringForward, onSendBack, onUndo, onCommitUndo, onCreateSticker }) {
  const DEPT_LABELS = ['Item', 'Reference', 'Description', ...depts.map(d => d.label)]
  const DEPT_COLORS = [null, null, null, ...depts.map(d => d.color)]
  const isMobile = useIsMobile()
  const containerRef = useRef(null)
  const fileInputRef = useRef(null)
  const [scale, setScale] = useState(0.55)
  const [pan, setPan] = useState(null) // null = needs centering
  const [dragging, setDragging] = useState(false)
  const [dropHighlight, setDropHighlight] = useState(false)
  const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  // Live refs so the wheel handler always reads the latest pan/scale without
  // relying on closure capture or nested setState updaters (which React can
  // re-invoke for purity, double-applying the zoom ratio).
  const panRef = useRef(pan)
  const scaleRef = useRef(scale)
  useEffect(() => { panRef.current = pan }, [pan])
  useEffect(() => { scaleRef.current = scale }, [scale])

  // Tool palette state. Available tools: select | hand | text | rect | ellipse | arrow.
  // While a drawing tool is active, mousedown on the background canvas starts a "draft"
  // that the user drags out — on mouseup the draft becomes a real sticker.
  // Default to Hand: panning is safe, Select can move things by accident. Press V or
  // click the Select tool to switch into manipulation mode.
  const [activeTool, setActiveTool] = useState('hand')
  const [spaceHeld, setSpaceHeld] = useState(false) // Space-to-pan (Figma/Miro style)
  const effectiveTool = spaceHeld ? 'hand' : activeTool
  const [draft, setDraft] = useState(null) // { kind, sx, sy, ex, ey } in board coords during drag
  // Selection is centralised here: a Set of sticker ids, so we can support
  // single click, additive (Shift/Ctrl) click, and marquee box-selection without
  // the per-sticker selection-state drift that lets handles linger on multiple stickers.
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const selectedIdsRef = useRef(selectedIds)
  selectedIdsRef.current = selectedIds
  // Marquee (left-drag on empty canvas while in Select mode). Coordinates are stored
  // in board space so the rectangle stays anchored to the world as the user pans/zooms.
  const [marquee, setMarquee] = useState(null) // { sx, sy, ex, ey } in board coords
  // Pen / eraser state. Live path stores the points being drawn this stroke; brush
  // settings persist across strokes. Eraser tracks the screen-space cursor so we can
  // render a preview circle while the user moves it around.
  const [penColor, setPenColor] = useState('#1a1a1a')
  const [penSize, setPenSize] = useState(4)
  const [eraserSize, setEraserSize] = useState(24)
  const [livePath, setLivePath] = useState(null) // { points: [[x,y],...] } in board coords
  const [erasing, setErasing] = useState(false)
  const [eraserPos, setEraserPos] = useState(null) // { x, y } in screen coords (preview)
  // Per-gesture snapshot of every stroke at mousedown. On mouseup we diff against
  // the current state to emit one batched undo entry that restores all the
  // strokes the eraser touched during this drag — including ones that ended up
  // fully erased (removed entirely).
  const eraseSnapshot = useRef(new Map())
  // Stroke selection & area-move (Sposta-disegno tool). Strokes are not part of
  // the normal selectedIds flow — they live on the drawing layer and need their
  // own marquee/group-drag pipeline that ignores every other element type.
  const [selectedStrokeIds, setSelectedStrokeIds] = useState(() => new Set())
  const [strokeMarquee, setStrokeMarquee] = useState(null) // { sx, sy, ex, ey, additive }
  const [strokeGroupAction, setStrokeGroupAction] = useState(null) // { mx, my, snaps: Map<id, {x,y}> }
  const selectedStrokeIdsRef = useRef(selectedStrokeIds)
  selectedStrokeIdsRef.current = selectedStrokeIds

  // Union bbox of every currently selected stroke. Lives in board space, used to
  // both render the dashed selection outline and to hit-test the cursor inside it
  // (= start a group drag) vs. outside it (= start a new marquee). Declared here
  // — before any useCallback that closes over it — so that the dep arrays of
  // those callbacks don't reference it during the TDZ window.
  const strokeGroupBbox = useMemo(() => {
    if (selectedStrokeIds.size === 0) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const id of selectedStrokeIds) {
      const s = stickers.find(x => x.id === id)
      if (!s || s.kind !== 'stroke') continue
      if (s.x < minX) minX = s.x
      if (s.y < minY) minY = s.y
      if (s.x + s.w > maxX) maxX = s.x + s.w
      if (s.y + s.h > maxY) maxY = s.y + s.h
    }
    if (!Number.isFinite(minX)) return null
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }, [selectedStrokeIds, stickers])
  // Group manipulation. While active, mousemove on window applies the captured deltas
  // to every selected sticker via handleStickerUpdate. We snapshot the starting geometry
  // for every selected sticker once on mousedown so resizes / drags scale relative to
  // a consistent anchor and the relative layout is preserved exactly.
  const [groupAction, setGroupAction] = useState(null)
  // groupAction shape (drag):   { kind: 'drag',   mx, my, snaps: Map<id, {x,y}> }
  // groupAction shape (resize): { kind: 'resize', mx, my, handle, bbox: {x,y,w,h}, snaps: Map<id, {x,y,w,h}> }

  // Per-shot measured description height. Updated by a ResizeObserver attached to the
  // inner description block (which has no height constraint, so its scrollHeight = the
  // natural wrapped-text height under the real loaded fonts). This is the authoritative
  // height used by computeRowH after first paint.
  const [descHeights, setDescHeights] = useState({})
  const descObservers = useRef({}) // shotId -> { observer }
  const descRefCache = useRef({})  // shotId -> stable ref callback
  const descRef = useCallback((shotId) => {
    if (descRefCache.current[shotId]) return descRefCache.current[shotId]
    const fn = (el) => {
      const prev = descObservers.current[shotId]
      if (prev) prev.observer.disconnect()
      if (!el) { delete descObservers.current[shotId]; return }
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const h = Math.ceil(entry.contentRect.height)
          setDescHeights(prevMap => prevMap[shotId] === h ? prevMap : { ...prevMap, [shotId]: h })
        }
      })
      observer.observe(el)
      descObservers.current[shotId] = { observer }
    }
    descRefCache.current[shotId] = fn
    return fn
  }, [])
  useEffect(() => () => {
    for (const k in descObservers.current) descObservers.current[k].observer.disconnect()
    descObservers.current = {}
    descRefCache.current = {}
  }, [])

  // Same pattern as descHeights, but for the multi-image masonry block inside
  // BoardCell. Images load asynchronously so the column-balanced height is only
  // known after-the-fact — ResizeObserver feeds it back, computeRowH picks it
  // up, the row re-flows to fit. Keyed by `${itemId}__${deptId}` because the
  // same item has independent masonry stacks per department.
  const [cellHeights, setCellHeights] = useState({})
  const cellObservers = useRef({}) // key -> { observer }
  const cellRefCache = useRef({})  // key -> stable ref callback
  const cellRef = useCallback((itemId, deptId) => {
    const key = `${itemId}__${deptId}`
    if (cellRefCache.current[key]) return cellRefCache.current[key]
    const fn = (el) => {
      const prev = cellObservers.current[key]
      if (prev) prev.observer.disconnect()
      if (!el) { delete cellObservers.current[key]; return }
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const h = Math.ceil(entry.contentRect.height)
          setCellHeights(prevMap => prevMap[key] === h ? prevMap : { ...prevMap, [key]: h })
        }
      })
      observer.observe(el)
      cellObservers.current[key] = { observer }
    }
    cellRefCache.current[key] = fn
    return fn
  }, [])
  useEffect(() => () => {
    for (const k in cellObservers.current) cellObservers.current[k].observer.disconnect()
    cellObservers.current = {}
    cellRefCache.current = {}
  }, [])

  // Convert screen coordinates to board coordinates (inverse of the pan+scale transform).
  // Rounds to integer board units by default (sticker placement wants stable coords);
  // pass `precise: true` to get sub-pixel floats — used by the pen so dense pointer
  // samples don't all snap to the same integer at 1:1 zoom (visible as stairstep).
  const screenToBoard = useCallback((clientX, clientY, opts) => {
    const el = containerRef.current
    if (!el) return { x: 200, y: 200 }
    const rect = el.getBoundingClientRect()
    const ap = pan || { x: 40, y: 20 }
    const x = (clientX - rect.left - ap.x) / scale
    const y = (clientY - rect.top - ap.y) / scale
    if (opts && opts.precise) return { x, y }
    return { x: Math.round(x), y: Math.round(y) }
  }, [pan, scale])

  // Board coords for the center of the currently visible viewport (used by toolbar adds)
  const viewportCenterBoard = useCallback(() => {
    const el = containerRef.current
    if (!el) return { x: 300, y: 300 }
    return screenToBoard(el.getBoundingClientRect().left + el.clientWidth / 2,
                         el.getBoundingClientRect().top + el.clientHeight / 2)
  }, [screenToBoard])

  // Robust drop: files, URL drags, plain text — all map to a sticker.
  const handleDrop = useCallback(async (e) => {
    if (!creativeMode) return
    e.preventDefault(); e.stopPropagation(); setDropHighlight(false)
    const { x: bx, y: by } = screenToBoard(e.clientX, e.clientY)
    const cx = bx - 100, cy = by - 100

    const dt = e.dataTransfer
    // Safari: prefer dataTransfer.files but fall back to .items where files can be empty
    const files = []
    if (dt?.files && dt.files.length) for (const f of dt.files) files.push(f)
    if (!files.length && dt?.items && dt.items.length) {
      for (const it of dt.items) {
        if (it.kind === 'file') {
          const f = it.getAsFile()
          if (f) files.push(f)
        }
      }
    }
    if (files.length) {
      let i = 0
      for (const f of files) {
        if (f.type.startsWith('image/')) {
          onCreateSticker({ kind: 'image', file: f, x: cx + i * 24, y: cy + i * 24 })
          i++
        }
      }
      if (i > 0) return
    }

    const uri = dt?.getData('text/uri-list') || ''
    const plain = dt?.getData('text/plain') || ''
    const candidate = uri || plain
    if (candidate && /^(https?:|data:image\/)/i.test(candidate.trim())) {
      try {
        const r = await fetch(candidate.trim())
        const b = await r.blob()
        if (b.type.startsWith('image/')) {
          const ext = (b.type.split('/')[1] || 'png').split('+')[0]
          const f = new File([b], `dropped.${ext}`, { type: b.type })
          onCreateSticker({ kind: 'image', file: f, x: cx, y: cy })
          return
        }
      } catch {}
    }

    if (plain && plain.trim()) {
      onCreateSticker({ kind: 'text', text: plain.trim(), x: cx, y: cy })
    }
  }, [creativeMode, screenToBoard, onCreateSticker])

  const handleDragOver = useCallback((e) => {
    if (!creativeMode) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    setDropHighlight(true)
  }, [creativeMode])

  const handleDragLeave = useCallback((e) => {
    if (!creativeMode) return
    // Only clear when leaving the container (not its children)
    if (e.currentTarget === e.target) setDropHighlight(false)
  }, [creativeMode])

  const onFilesPicked = useCallback((e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const c = viewportCenterBoard()
    files.forEach((f, i) => {
      if (f.type.startsWith('image/')) {
        onCreateSticker({ kind: 'image', file: f, x: c.x - 100 + i * 24, y: c.y - 100 + i * 24 })
      }
    })
    e.target.value = ''
  }, [viewportCenterBoard, onCreateSticker])

  const handleAddText = useCallback(() => {
    const c = viewportCenterBoard()
    onCreateSticker({ kind: 'text', text: '', x: c.x - 120, y: c.y - 30, w: 240, h: 60 })
  }, [viewportCenterBoard, onCreateSticker])

  // Zoom toward cursor — tool-agnostic. We read pan/scale through refs and
  // dispatch two independent state updates so the ratio math runs exactly
  // once per wheel event (React can re-invoke nested setState updaters for
  // purity, which previously caused the cursor anchor to drift off-target).
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const factor = e.deltaY > 0 ? 0.92 : 1.08

      const prev = scaleRef.current
      const next = Math.min(40, Math.max(0.05, prev * factor))
      if (next === prev) return
      const ratio = next / prev
      // Fallback if pan hasn't been auto-centered yet (first paint race).
      const p = panRef.current || { x: 40, y: 20 }

      // Pre-write the refs so any state update later in this tick that
      // reads them sees the new values.
      scaleRef.current = next
      const newPan = {
        x: mx - ratio * (mx - p.x),
        y: my - ratio * (my - p.y),
      }
      panRef.current = newPan

      setScale(next)
      setPan(newPan)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Eraser hit-test: erase the portion of any 'stroke' sticker whose path passes
  // within (eraser radius + half stroke thickness) of the cursor. We only target
  // strokes — text, shapes, images are intentionally protected so the user can't
  // accidentally wipe a reference with the eraser.
  //
  // Behaviour is "draw by erasing": for every frame the cursor is held down, we
  // remove individual points from each touched stroke's sub-polylines, splitting
  // them where there's a gap. The sticker stays alive until ALL its sub-polylines
  // are gone — only then do we remove it from local state (DB cleanup happens at
  // mouseup so a single eraser gesture only takes one undo to revert).
  const eraseAt = useCallback((clientX, clientY) => {
    const b = screenToBoard(clientX, clientY)
    const radius = eraserSize / 2
    for (const s of stickers) {
      if (s.kind !== 'stroke') continue
      // Quick AABB reject — strokes that aren't anywhere near the cursor are
      // skipped without parsing their points.
      const r = radius + (s.font_size || 4) / 2
      if (b.x + r < s.x || b.x - r > s.x + s.w || b.y + r < s.y || b.y - r > s.y + s.h) continue
      const data = parseStroke(s.text_content)
      if (!data || data.segments.length === 0) continue
      const hitR2 = r * r
      // Point hit-test in stroke-local coordinate space. The points are stored
      // relative to the sticker's top-left in the stroke's natural (viewBox)
      // space, so we map the cursor into that same space before comparing —
      // the stored viewBox dimensions (data.w/h) may differ from the current
      // sticker w/h if the stroke has been resized.
      const sxScale = data.w / Math.max(s.w, 1)
      const syScale = data.h / Math.max(s.h, 1)
      const localBx = (b.x - s.x) * sxScale
      const localBy = (b.y - s.y) * syScale
      const localR2 = hitR2 * Math.min(sxScale * sxScale, syScale * syScale)
      const nextSegs = eraseSegmentsByHit(data.segments, (px, py) => {
        const dx = px - localBx, dy = py - localBy
        return dx * dx + dy * dy <= localR2
      })
      if (nextSegs.length === data.segments.length &&
          nextSegs.every((seg, i) => seg.length === data.segments[i].length)) {
        continue // nothing actually changed for this stroke this frame
      }
      const nextPayload = { w: data.w, h: data.h, segs: nextSegs }
      onStickerUpdate(s.id, { text_content: JSON.stringify(nextPayload) })
    }
  }, [stickers, eraserSize, screenToBoard, onStickerUpdate])

  // Mouse buttons & tools matrix:
  //   middle / right click  → pan (any tool)
  //   left + Hand tool       → pan
  //   left + drawing tool    → start drawing draft
  //   left + Select tool     → start marquee box-selection on the empty board.
  //                            Sticker mousedowns stop propagation, so this only fires
  //                            on empty surface.
  //   Space held            → temporarily acts as Hand (handled via spaceHeld in
  //                            effectiveTool above).
  const handleMouseDown = useCallback((e) => {
    const p = pan || { x: 40, y: 20 }
    // Middle button or right button → pan.
    if (e.button === 1 || e.button === 2) {
      e.preventDefault()
      setDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY, panX: p.x, panY: p.y }
      return
    }
    if (e.button !== 0) return

    // A drawing tool is active → start a draft at the mouse position (in board coords).
    if (creativeMode && (effectiveTool === 'text' || effectiveTool === 'rect' || effectiveTool === 'ellipse' || effectiveTool === 'arrow')) {
      e.preventDefault()
      const b = screenToBoard(e.clientX, e.clientY)
      setDraft({ kind: effectiveTool === 'text' ? 'text' : effectiveTool, sx: b.x, sy: b.y, ex: b.x, ey: b.y })
      return
    }

    // Pen: start a fresh stroke. Points are sampled in board coordinates so the
    // stroke remains crisp when the user later pans / zooms. We commit one sticker
    // per gesture on mouseup → one stroke = one undo entry.
    if (creativeMode && effectiveTool === 'pen') {
      e.preventDefault()
      const b = screenToBoard(e.clientX, e.clientY, { precise: true })
      setLivePath({ points: [[b.x, b.y]] })
      return
    }

    // Sposta-disegno: mousedown either starts a marquee (if the cursor is outside
    // the current stroke selection or there is none) or a group drag (if the cursor
    // is inside the bbox of the already-selected strokes). Strokes never become
    // clickable individually — area-select is the only entry point.
    if (creativeMode && effectiveTool === 'strokemove') {
      e.preventDefault()
      const b = screenToBoard(e.clientX, e.clientY)
      const inside = strokeGroupBbox &&
        b.x >= strokeGroupBbox.x && b.x <= strokeGroupBbox.x + strokeGroupBbox.w &&
        b.y >= strokeGroupBbox.y && b.y <= strokeGroupBbox.y + strokeGroupBbox.h
      if (inside) {
        // Snapshot every selected stroke's position so the move is reversible as
        // a single Ctrl+Z and the relative spacing between strokes is preserved.
        const snaps = new Map()
        for (const id of selectedStrokeIds) {
          const s = stickers.find(x => x.id === id)
          if (s) snaps.set(id, { x: s.x, y: s.y })
        }
        setStrokeGroupAction({ mx: e.clientX, my: e.clientY, snaps })
        return
      }
      const additive = e.shiftKey || e.metaKey || e.ctrlKey
      if (!additive) setSelectedStrokeIds(new Set())
      setStrokeMarquee({ sx: b.x, sy: b.y, ex: b.x, ey: b.y, additive })
      return
    }

    // Eraser: begin a gesture. Snapshot the FULL state of every stroke so we can
    // emit a single batched undo entry at mouseup that restores them all in one
    // Ctrl+Z (regardless of how many strokes the user dragged across).
    if (creativeMode && effectiveTool === 'eraser') {
      e.preventDefault()
      const snap = new Map()
      for (const s of stickers) {
        if (s.kind === 'stroke') snap.set(s.id, { ...s })
      }
      eraseSnapshot.current = snap
      setErasing(true)
      eraseAt(e.clientX, e.clientY)
      return
    }

    // Select tool + left click on empty board → marquee. Unless Shift/Ctrl held (then
    // the marquee adds to the existing selection on release).
    if (creativeMode && effectiveTool === 'select') {
      const b = screenToBoard(e.clientX, e.clientY)
      const additive = e.shiftKey || e.metaKey || e.ctrlKey
      if (!additive) setSelectedIds(new Set()) // clear so the user sees an immediate reset
      setMarquee({ sx: b.x, sy: b.y, ex: b.x, ey: b.y, additive })
      return
    }

    // Hand tool (or fallback) with left button → pan.
    setDragging(true)
    dragStart.current = { x: e.clientX, y: e.clientY, panX: p.x, panY: p.y }
  }, [pan, creativeMode, effectiveTool, screenToBoard, eraseAt, stickers, strokeGroupBbox, selectedStrokeIds])

  const handleMouseMove = useCallback((e) => {
    if (livePath) {
      // Browsers coalesce pointer events down to one per paint frame, which
      // makes fast pen strokes spiky (smoothPath has too few samples to fit a
      // nice curve through). getCoalescedEvents returns the raw sub-frame
      // samples the OS actually captured — feed them all in so the Q-curve
      // smoothing has dense input.
      const events = (typeof e.getCoalescedEvents === 'function')
        ? e.getCoalescedEvents() : null
      const samples = (events && events.length > 0) ? events : [e]
      const newPts = []
      for (const ev of samples) {
        const b = screenToBoard(ev.clientX, ev.clientY, { precise: true })
        newPts.push([b.x, b.y])
      }
      setLivePath(p => {
        if (!p) return p
        const merged = p.points.slice()
        let last = merged[merged.length - 1]
        for (const pt of newPts) {
          if (last && last[0] === pt[0] && last[1] === pt[1]) continue
          merged.push(pt); last = pt
        }
        if (merged.length === p.points.length) return p
        return { points: merged }
      })
      return
    }
    if (erasing) {
      eraseAt(e.clientX, e.clientY)
      return
    }
    if (strokeMarquee) {
      const b = screenToBoard(e.clientX, e.clientY)
      setStrokeMarquee(m => m ? { ...m, ex: b.x, ey: b.y } : m)
      return
    }
    if (strokeGroupAction) {
      const dx = (e.clientX - strokeGroupAction.mx) / scale
      const dy = (e.clientY - strokeGroupAction.my) / scale
      for (const [id, start] of strokeGroupAction.snaps) {
        onStickerUpdate(id, { x: Math.round(start.x + dx), y: Math.round(start.y + dy) })
      }
      return
    }
    if (draft) {
      const b = screenToBoard(e.clientX, e.clientY)
      setDraft(d => d ? { ...d, ex: b.x, ey: b.y } : d)
      return
    }
    if (marquee) {
      const b = screenToBoard(e.clientX, e.clientY)
      setMarquee(m => m ? { ...m, ex: b.x, ey: b.y } : m)
      return
    }
    if (!dragging) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy })
  }, [dragging, draft, marquee, livePath, erasing, eraseAt, strokeMarquee, strokeGroupAction, scale, onStickerUpdate, screenToBoard])

  const handleMouseUp = useCallback(() => {
    if (livePath) {
      // Need at least 2 points (a real stroke). A bare click without movement is
      // silently dropped — most users tap accidentally while reaching for another tool.
      if (livePath.points.length >= 2) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const [x, y] of livePath.points) {
          if (x < minX) minX = x; if (y < minY) minY = y
          if (x > maxX) maxX = x; if (y > maxY) maxY = y
        }
        const pad = Math.max(2, penSize) // ensures stroke caps don't get clipped
        minX -= pad; minY -= pad; maxX += pad; maxY += pad
        const w = Math.round(maxX - minX), h = Math.round(maxY - minY)
        // Convert absolute board points → coords local to the new sticker's top-left.
        // Storing local coords means moving / duplicating the sticker doesn't require
        // re-baselining the path — just translate the sticker's (x, y).
        // Keep one decimal of precision so the path doesn't snap to the integer
        // grid (which produces visible stairstep on thin strokes at 1:1 zoom).
        const rel = livePath.points.map(([x, y]) => [
          Math.round((x - minX) * 10) / 10,
          Math.round((y - minY) * 10) / 10,
        ])
        // New format with explicit natural extent + sub-polylines (one to start;
        // the eraser may split it later).
        const payload = { w, h, segs: [rel] }
        onCreateSticker({
          kind: 'stroke',
          x: Math.round(minX), y: Math.round(minY),
          w, h,
          text: JSON.stringify(payload),
          text_color: penColor,
          font_size: penSize,
          // Pre-rendered preview points so the parent can drop in the optimistic
          // sticker WITHOUT waiting for the DB roundtrip — no flicker at release.
          _optimistic: true,
        })
      }
      setLivePath(null)
      return
    }
    if (strokeMarquee) {
      const x1 = Math.min(strokeMarquee.sx, strokeMarquee.ex), x2 = Math.max(strokeMarquee.sx, strokeMarquee.ex)
      const y1 = Math.min(strokeMarquee.sy, strokeMarquee.ey), y2 = Math.max(strokeMarquee.sy, strokeMarquee.ey)
      const tinyDrag = (x2 - x1) < 4 && (y2 - y1) < 4
      if (tinyDrag) { setStrokeMarquee(null); return }
      // Hit-test: every stroke whose bbox intersects the marquee. We only look at
      // strokes — the whole tool's contract is "select drawings, leave everything
      // else alone".
      const hits = []
      for (const s of stickers) {
        if (s.kind !== 'stroke') continue
        if (s.x < x2 && s.x + s.w > x1 && s.y < y2 && s.y + s.h > y1) hits.push(s.id)
      }
      setSelectedStrokeIds(prev => {
        if (strokeMarquee.additive) {
          const next = new Set(prev)
          for (const id of hits) next.add(id)
          return next
        }
        return new Set(hits)
      })
      setStrokeMarquee(null)
      return
    }
    if (strokeGroupAction) {
      // Commit one batched undo entry — one Ctrl+Z reverts the whole group move
      // back to the positions captured at mousedown.
      const entries = []
      for (const [id, snap] of strokeGroupAction.snaps) {
        const cur = stickers.find(x => x.id === id)
        if (!cur) continue
        if (cur.x !== snap.x || cur.y !== snap.y) {
          entries.push({ type: 'update', id, before: { x: snap.x, y: snap.y } })
        }
      }
      if (entries.length > 0) onCommitUndo?.({ type: 'multi', entries })
      setStrokeGroupAction(null)
      return
    }
    if (erasing) {
      // Build a batched undo entry from the snapshot taken at mousedown. For
      // each stroke the user touched: if it's now empty (no sub-polylines left)
      // we tear down the row entirely; otherwise we keep an 'update' entry
      // with the original text_content.
      const beforeEntries = []
      for (const [id, before] of eraseSnapshot.current) {
        const now = stickers.find(x => x.id === id)
        if (!now) continue // somebody else's realtime delete — leave it alone
        if (before.text_content === now.text_content) continue
        const data = parseStroke(now.text_content)
        if (!data || data.segments.length === 0) {
          // Fully erased → schedule a hard delete (no separate undo entry, the
          // batch will recreate the original sticker on Ctrl+Z).
          onStickerDelete?.(id, { skipUndo: true })
          beforeEntries.push({ type: 'delete', sticker: before })
        } else {
          beforeEntries.push({ type: 'update', id, before: { text_content: before.text_content } })
        }
      }
      if (beforeEntries.length > 0) {
        onCommitUndo?.({ type: 'multi', entries: beforeEntries })
      }
      eraseSnapshot.current = new Map()
      setErasing(false)
      return
    }
    if (marquee) {
      const x1 = Math.min(marquee.sx, marquee.ex), x2 = Math.max(marquee.sx, marquee.ex)
      const y1 = Math.min(marquee.sy, marquee.ey), y2 = Math.max(marquee.sy, marquee.ey)
      const tinyDrag = (x2 - x1) < 4 && (y2 - y1) < 4
      if (tinyDrag) {
        // Treat as a plain click on background → clear selection (already cleared in
        // mousedown when not additive). Nothing more to do.
        setMarquee(null)
        return
      }
      // Bounding-box intersection — fast and matches user expectation (Figma-style).
      // Arrows have signed w/h so we normalise to an absolute box just for hit-testing.
      // Strokes are deliberately skipped: they belong to the drawing-layer overlay
      // and aren't supposed to participate in pointer selection at all.
      const hits = []
      for (const s of stickers) {
        if (s.kind === 'stroke') continue
        const sx = s.w < 0 ? s.x + s.w : s.x
        const sy = s.h < 0 ? s.y + s.h : s.y
        const sw = Math.abs(s.w), sh = Math.abs(s.h)
        const intersects = sx < x2 && sx + sw > x1 && sy < y2 && sy + sh > y1
        if (intersects) hits.push(s.id)
      }
      setSelectedIds(prev => {
        if (marquee.additive) {
          const next = new Set(prev)
          for (const id of hits) next.add(id)
          return next
        }
        return new Set(hits)
      })
      setMarquee(null)
      return
    }
    if (draft) {
      const dxAbs = Math.abs(draft.ex - draft.sx)
      const dyAbs = Math.abs(draft.ey - draft.sy)
      const drag = dxAbs > 6 || dyAbs > 6
      if (draft.kind === 'arrow') {
        if (drag) onCreateSticker({ kind: 'arrow', x: draft.sx, y: draft.sy, w: draft.ex - draft.sx, h: draft.ey - draft.sy })
      } else if (draft.kind === 'rect' || draft.kind === 'ellipse') {
        const x = Math.min(draft.sx, draft.ex)
        const y = Math.min(draft.sy, draft.ey)
        const w = Math.max(60, dxAbs), h = Math.max(40, dyAbs)
        onCreateSticker({ kind: draft.kind, x, y, w, h })
      } else if (draft.kind === 'text') {
        const x = Math.min(draft.sx, draft.ex)
        const y = Math.min(draft.sy, draft.ey)
        const w = drag ? Math.max(80, dxAbs) : 240
        const h = drag ? Math.max(40, dyAbs) : 60
        onCreateSticker({ kind: 'text', text: '', x, y, w, h })
      }
      setDraft(null)
      // After drawing, return to Select — the user is already interacting and likely
      // wants to manipulate / position the new object. Hand is only the *initial*
      // safe default at page load.
      setActiveTool('select')
      return
    }
    setDragging(false)
  }, [draft, marquee, stickers, livePath, erasing, strokeMarquee, strokeGroupAction, penColor, penSize, onCreateSticker, onStickerDelete, onCommitUndo])

  // Switching away from the Sposta-disegno tool clears the stroke selection so
  // the user doesn't see an orphan dashed bbox floating over the board while
  // working with another tool.
  useEffect(() => {
    if (effectiveTool !== 'strokemove' && selectedStrokeIds.size > 0) {
      setSelectedStrokeIds(new Set())
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTool])

  // Track the cursor while the eraser tool is active so we can render a small
  // preview circle showing the brush radius. Only attached when the tool is armed.
  useEffect(() => {
    if (!creativeMode || effectiveTool !== 'eraser') { setEraserPos(null); return }
    const el = containerRef.current
    if (!el) return
    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      setEraserPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }
    const onLeave = () => setEraserPos(null)
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    return () => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    }
  }, [creativeMode, effectiveTool])

  useEffect(() => {
    if (dragging || draft || marquee || livePath || erasing || strokeMarquee || strokeGroupAction) {
      window.addEventListener('pointermove', handleMouseMove)
      window.addEventListener('pointerup', handleMouseUp)
      return () => {
        window.removeEventListener('pointermove', handleMouseMove)
        window.removeEventListener('pointerup', handleMouseUp)
      }
    }
  }, [dragging, draft, marquee, livePath, erasing, strokeMarquee, strokeGroupAction, handleMouseMove, handleMouseUp])

  // Selection helper passed to each StickerItem. Sticker calls this on mousedown:
  //   additive=true (Shift/Ctrl) → toggle membership without losing the rest.
  //   additive=false             → if id is already in the selection, keep the
  //                                selection intact (so a click-and-drag on a
  //                                multi-selected sticker initiates a group drag);
  //                                otherwise collapse the selection to just that id.
  const selectSticker = useCallback((id, { additive = false } = {}) => {
    setSelectedIds(prev => {
      if (additive) {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id); else next.add(id)
        return next
      }
      if (prev.has(id)) return prev
      return new Set([id])
    })
  }, [])

  // Group drag — engaged when the user mousedowns on a sticker that's part of a
  // multi-selection. We snapshot every selected sticker's starting position once,
  // then translate them all by the same delta. Relative positions are preserved
  // exactly (no rounding drift across moves because the delta is always computed
  // from the original snapshot, not the previous frame).
  const beginGroupDrag = useCallback((e) => {
    const ids = Array.from(selectedIdsRef.current)
    if (ids.length === 0) return
    const snaps = new Map()
    for (const id of ids) {
      const s = stickers.find(x => x.id === id)
      if (s) snaps.set(id, { x: s.x, y: s.y })
    }
    setGroupAction({ kind: 'drag', mx: e.clientX, my: e.clientY, snaps,
      // For undo: capture full geometry on every sticker so we can restore on Ctrl+Z.
      beforeAll: ids.map(id => {
        const s = stickers.find(x => x.id === id)
        return s ? { id, before: { x: s.x, y: s.y, w: s.w, h: s.h, rotation: s.rotation || 0 } } : null
      }).filter(Boolean),
    })
  }, [stickers])

  // Group bbox in board coordinates — derived from all currently selected stickers.
  // Returns null when fewer than 2 are selected (single-selection has its own chrome).
  const groupBbox = useMemo(() => {
    if (selectedIds.size < 2) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const id of selectedIds) {
      const s = stickers.find(x => x.id === id)
      if (!s) continue
      const sx = s.w < 0 ? s.x + s.w : s.x
      const sy = s.h < 0 ? s.y + s.h : s.y
      const sw = Math.abs(s.w), sh = Math.abs(s.h)
      if (sx < minX) minX = sx
      if (sy < minY) minY = sy
      if (sx + sw > maxX) maxX = sx + sw
      if (sy + sh > maxY) maxY = sy + sh
    }
    if (!Number.isFinite(minX)) return null
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  }, [selectedIds, stickers])

  // Begin a group resize from one of the 8 handles on the group bbox.
  // We snapshot each sticker's geometry relative to the bbox so we can rescale
  // proportionally: nx = bbox.x + (sx - bbox.x) * scaleX, nw = sw * scaleX, etc.
  // This preserves the relative spacing between every pair of selected stickers.
  const beginGroupResize = useCallback((e, handle) => {
    e.stopPropagation(); e.preventDefault()
    if (!groupBbox) return
    const ids = Array.from(selectedIdsRef.current)
    const snaps = new Map()
    for (const id of ids) {
      const s = stickers.find(x => x.id === id)
      if (s) snaps.set(id, { x: s.x, y: s.y, w: s.w, h: s.h })
    }
    setGroupAction({ kind: 'resize', mx: e.clientX, my: e.clientY, handle,
      bbox: { ...groupBbox }, snaps,
      beforeAll: ids.map(id => {
        const s = stickers.find(x => x.id === id)
        return s ? { id, before: { x: s.x, y: s.y, w: s.w, h: s.h, rotation: s.rotation || 0 } } : null
      }).filter(Boolean),
    })
  }, [groupBbox, stickers])

  // Window-level mousemove/mouseup driver for group actions. Lives separately from
  // the canvas-level driver so it keeps working even when the cursor crosses outside
  // the canvas surface mid-gesture.
  useEffect(() => {
    if (!groupAction) return
    const onMove = (e) => {
      const dx = (e.clientX - groupAction.mx) / scale
      const dy = (e.clientY - groupAction.my) / scale
      if (groupAction.kind === 'drag') {
        for (const [id, start] of groupAction.snaps) {
          onStickerUpdate(id, { x: Math.round(start.x + dx), y: Math.round(start.y + dy) })
        }
        return
      }
      // resize
      const { handle, bbox, snaps } = groupAction
      const MIN = 8 // minimum group dimension, in board px
      // Compute the new bbox by moving the dragged handle. Sides anchor the opposite
      // edge; corners anchor the diagonally-opposite corner.
      let nx = bbox.x, ny = bbox.y, nw = bbox.w, nh = bbox.h
      if (handle === 'br' || handle === 'tr' || handle === 'r') nw = Math.max(MIN, bbox.w + dx)
      if (handle === 'bl' || handle === 'tl' || handle === 'l') { nw = Math.max(MIN, bbox.w - dx); nx = bbox.x + bbox.w - nw }
      if (handle === 'br' || handle === 'bl' || handle === 'b') nh = Math.max(MIN, bbox.h + dy)
      if (handle === 'tr' || handle === 'tl' || handle === 't') { nh = Math.max(MIN, bbox.h - dy); ny = bbox.y + bbox.h - nh }
      const sxScale = nw / bbox.w
      const syScale = nh / bbox.h
      for (const [id, st] of snaps) {
        // Map sticker geometry from old bbox space to new bbox space. Negative w/h
        // (arrows pointing left/up) are preserved by scaling the signed value.
        const relX = st.x - bbox.x
        const relY = st.y - bbox.y
        onStickerUpdate(id, {
          x: Math.round(nx + relX * sxScale),
          y: Math.round(ny + relY * syScale),
          w: Math.round(st.w * sxScale),
          h: Math.round(st.h * syScale),
        })
      }
    }
    const onUp = () => {
      // One undo entry per sticker (the existing undo model uses per-id 'update'
      // entries; pushing N keeps Ctrl+Z atomic per group gesture if the user
      // presses Ctrl+Z N times — acceptable, and avoids inventing a new entry type).
      const before = groupAction.beforeAll || []
      for (const { id, before: b } of before) {
        const s = stickers.find(x => x.id === id)
        if (!s) continue
        if (b.x !== s.x || b.y !== s.y || b.w !== s.w || b.h !== s.h) {
          onCommitUndo?.({ type: 'update', id, before: b })
        }
      }
      setGroupAction(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [groupAction, scale, onStickerUpdate, onCommitUndo, stickers])

  // Keyboard shortcuts (Figma-style). Skip while typing in any editable element.
  useEffect(() => {
    if (!creativeMode) return
    const isTypingTarget = (el) => el && (el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')
    const onKey = (e) => {
      if (isTypingTarget(e.target) || isTypingTarget(document.activeElement)) return
      const k = e.key
      if (k === 'Escape') {
        if (draft) setDraft(null)
        if (selectedIdsRef.current.size > 0) setSelectedIds(new Set())
        if (selectedStrokeIdsRef.current.size > 0) setSelectedStrokeIds(new Set())
        setActiveTool('select') // back to interaction mode (user is already engaged)
        return
      }
      // Space → temporary hand tool while held
      if (k === ' ' && !e.repeat) { e.preventDefault(); setSpaceHeld(true); return }
      // Z-order shortcuts (Figma defaults). Apply to every selected sticker so the
      // whole group moves forward/back together.
      const mod = e.ctrlKey || e.metaKey
      if (mod && (k === ']' || k === '}')) {
        e.preventDefault()
        for (const id of selectedIdsRef.current) onBringForward?.(id)
        return
      }
      if (mod && (k === '[' || k === '{')) {
        e.preventDefault()
        for (const id of selectedIdsRef.current) onSendBack?.(id)
        return
      }
      // Select all stickers on the current board (Ctrl/⌘+A). Strokes excluded —
      // they belong to the drawing layer, not the selection model.
      if (mod && (k === 'a' || k === 'A')) {
        e.preventDefault()
        setSelectedIds(new Set(stickers.filter(s => s.kind !== 'stroke').map(s => s.id)))
        return
      }
      // Group delete — when 2+ stickers are selected. (Single selection already
      // handles its own Delete inside StickerItem.)
      if ((k === 'Delete' || k === 'Backspace') && selectedIdsRef.current.size > 1) {
        e.preventDefault()
        for (const id of selectedIdsRef.current) onStickerDelete?.(id)
        setSelectedIds(new Set())
        return
      }
      // Delete every selected stroke (any count). Strokes have their own
      // selection set so they don't fall under the rule above.
      if ((k === 'Delete' || k === 'Backspace') && selectedStrokeIdsRef.current.size > 0) {
        e.preventDefault()
        // Build a single 'multi' undo entry so Ctrl+Z restores the whole group.
        const entries = []
        for (const id of selectedStrokeIdsRef.current) {
          const s = stickers.find(x => x.id === id)
          if (s) entries.push({ type: 'delete', sticker: s })
        }
        for (const id of selectedStrokeIdsRef.current) onStickerDelete?.(id, { skipUndo: true })
        if (entries.length > 0) onCommitUndo?.({ type: 'multi', entries })
        setSelectedStrokeIds(new Set())
        return
      }
      // Undo (delete + create operations). Ctrl/⌘+Z. Skip Shift+Z to leave room for
      // a future redo, even though redo isn't implemented yet.
      if (mod && !e.shiftKey && (k === 'z' || k === 'Z')) {
        e.preventDefault()
        onUndo?.()
        return
      }
      // Tool shortcuts
      // Only the tools the user actually reaches by keyboard get a binding.
      // Shape tools (rect/ellipse/arrow) are click-only by design so we never
      // collide with the ones that matter (B/E/W especially).
      // Keys are matched on `e.key` which is locale- and OS-agnostic for ASCII
      // letters — same string on Mac and Windows.
      const toolKeys = { v: 'select', V: 'select', h: 'hand', H: 'hand',
        t: 'text', T: 'text',
        b: 'pen', B: 'pen',
        e: 'eraser', E: 'eraser',
        w: 'strokemove', W: 'strokemove' }
      if (toolKeys[k] && !mod) { e.preventDefault(); setActiveTool(toolKeys[k]); return }
    }
    const onKeyUp = (e) => { if (e.key === ' ') setSpaceHeld(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [creativeMode, draft, stickers, onBringForward, onSendBack, onUndo, onStickerDelete, onCommitUndo])

  // Calculate board layout positions
  const totalCols = 3 + depts.length
  const boardW = B_SHOT_W + B_REF_W + B_DESC_W + depts.length * B_CELL_W + (totalCols - 1) * B_GAP + 60
  let currentY = 0

  const rowPositions = []
  for (const [seq, seqItems] of sequences) {
    rowPositions.push({ type: 'seq', seq, y: currentY, count: seqItems.length })
    currentY += B_SEQ_H + B_GAP
    for (const item of seqItems) {
      const cellH = computeRowH(item, imageMap, depts, getDescription(item), descHeights, cellHeights)
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

  // Progressive image resolution. By default every cell paints the small R2
  // thumb (instant board, even with hundreds of images). A row only upgrades to
  // full-res originals when it is BOTH visible AND zoomed in past the thumb's
  // resolution — i.e. exactly the cells the user is looking at closely. This is
  // what turns the old ~30s full-res load into a near-instant one.
  const _dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1
  // On-screen device px of a full-width cell image at the current zoom.
  const _cellImgDevicePx = (B_CELL_W - 2 * MASONRY_PAD) * scale * _dpr
  const zoomNeedsHighRes = _cellImgDevicePx > THUMB_MAX_EDGE
  const _contH = containerRef.current?.clientHeight || 0
  // Visible board-Y window (inner board coords) + ~1 screen of preload margin.
  const _viewTopB = (-activePan.y) / scale
  const _viewBotB = (_contH - activePan.y) / scale
  const _marginB = _contH > 0 ? _contH / scale : 0
  const rowWantsHighRes = (rowTop, rowH) =>
    zoomNeedsHighRes && _contH > 0 &&
    rowTop < _viewBotB + _marginB && (rowTop + rowH) > _viewTopB - _marginB

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

  // Cursor for the canvas surface based on the active tool. In Select mode, hovering
  // the empty board shows a hand cursor — clicking-dragging there pans the view.
  // Stickers override with their own arrow cursor (set on the sticker container)
  // so the user can visually tell "this area pans" vs "this area is an object".
  const surfaceCursor = (() => {
    if (dragging) return 'grabbing'
    if (draft) return 'crosshair'
    if (effectiveTool === 'hand') return 'grab'
    if (effectiveTool === 'text') return 'text'
    if (effectiveTool === 'rect' || effectiveTool === 'ellipse' || effectiveTool === 'arrow') return 'crosshair'
    if (effectiveTool === 'pen') return 'crosshair'
    if (effectiveTool === 'eraser') return 'none' // a custom circle is drawn instead
    if (effectiveTool === 'strokemove') return strokeGroupAction ? 'grabbing' : 'crosshair'
    // Select mode: the regular OS arrow — same cursor Windows/macOS show for
    // standard box-selection on a file explorer / desktop. Left-drag spawns the
    // marquee, right-drag pans, so the "grab" hand from earlier was misleading.
    return 'default'
  })()

  return (
    <div ref={containerRef} onMouseDown={handleMouseDown} onAuxClick={e => e.preventDefault()}
      onContextMenu={e => e.preventDefault()}
      onDragEnter={creativeMode ? handleDragOver : undefined}
      onDragOver={creativeMode ? handleDragOver : undefined}
      onDragLeave={creativeMode ? handleDragLeave : undefined}
      onDrop={creativeMode ? handleDrop : undefined}
      style={{
        flex: 1, overflow: 'hidden', position: 'relative',
        cursor: surfaceCursor,
        background: dropHighlight ? '#FEF3C7' : '#E8ECF1',
        backgroundImage: dropHighlight ? 'none' : 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        transition: 'background 0.2s',
      }}>

      {/* Zoom controls — on mobile the bottom is occupied by the tool palette,
          so the zoom stack lives at top-right where the page header has free room. */}
      <div style={{
        position: 'absolute',
        ...(isMobile ? { top: 16, right: 16 } : { bottom: 16, right: 16 }),
        zIndex: 20, display: 'flex', flexDirection: 'column', gap: 4,
      }}>
        <button onClick={() => setScale(s => Math.min(40, s * 1.2))} style={zoomBtnStyle}>+</button>
        <button onClick={() => setScale(0.55)} style={{ ...zoomBtnStyle, fontSize: 10, fontWeight: 600 }}>{Math.round(scale * 100)}%</button>
        <button onClick={() => setScale(s => Math.max(0.05, s * 0.8))} style={zoomBtnStyle}>&minus;</button>
        <button onClick={resetView} title="Reset view" style={{ ...zoomBtnStyle, fontSize: 11 }}><IconTarget size={14} /></button>
      </div>

      {/* Tool palette (Creative mode) — Figma/Miro style vertical-ish row pinned top-center.
          Click a tool, then click-drag on the board to draw. Esc returns to Select.
          Image button opens the file picker. */}
      {creativeMode && (
        <div style={{
          // On mobile pin the toolbar to the bottom-center so it doesn't collide
          // with the page header (Storyboard title, tabs, mode toggle) which on
          // narrow screens wraps to two rows and sat directly above the buttons.
          position: 'absolute',
          ...(isMobile
            ? { bottom: 16, left: '50%', transform: 'translateX(-50%)' }
            : { top: 16, left: '50%', transform: 'translateX(-50%)' }),
          zIndex: 20,
          display: 'flex', gap: 4, padding: 5, borderRadius: 12,
          background: 'rgba(255,255,255,0.96)', border: '1px solid #E2E8F0',
          boxShadow: '0 6px 20px rgba(0,0,0,0.12)', backdropFilter: 'blur(8px)',
          maxWidth: 'calc(100vw - 24px)', overflowX: 'auto',
        }}>
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setActiveTool(t.id)} title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
              style={{
                width: 36, height: 36, borderRadius: 8, padding: 0,
                border: '1px solid transparent',
                background: activeTool === t.id ? '#F28C28' : 'transparent',
                color: activeTool === t.id ? '#fff' : '#475569',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.12s',
              }}>
              <ToolIcon id={t.id} active={activeTool === t.id} />
            </button>
          ))}
          <div style={{ width: 1, background: '#E2E8F0', margin: '4px 2px' }} />
          <button onClick={() => fileInputRef.current?.click()} title="Carica immagine"
            style={{
              width: 36, height: 36, borderRadius: 8, padding: 0,
              border: '1px solid transparent', background: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#475569',
            }}>
            <ToolIcon id="image" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" multiple
            style={{ display: 'none' }} onChange={onFilesPicked} />
        </div>
      )}

      {/* Hint chip when a drawing tool is armed */}
      {creativeMode && (effectiveTool === 'text' || effectiveTool === 'rect' || effectiveTool === 'ellipse' || effectiveTool === 'arrow') && !draft && (
        <div style={{
          position: 'absolute',
          ...(isMobile
            ? { bottom: 64, left: '50%', transform: 'translateX(-50%)' }
            : { top: 64, left: '50%', transform: 'translateX(-50%)' }),
          zIndex: 19,
          padding: '4px 10px', fontSize: 11, color: '#fff', background: 'rgba(15,23,42,0.85)',
          borderRadius: 999, pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
        }}>
          Trascina per disegnare · <kbd style={{ fontFamily: 'inherit', opacity: 0.7 }}>Esc</kbd> per annullare
        </div>
      )}

      {/* Pen options popover — size slider + colour swatches. Anchored just below
          the toolbar; pinned in screen-space so it doesn't pan with the board. */}
      {creativeMode && effectiveTool === 'pen' && (
        <div onMouseDown={e => e.stopPropagation()} style={{
          position: 'absolute',
          ...(isMobile
            ? { bottom: 64, left: '50%', transform: 'translateX(-50%)' }
            : { top: 64, left: '50%', transform: 'translateX(-50%)' }),
          zIndex: 19,
          padding: '8px 12px', background: 'rgba(255,255,255,0.97)', borderRadius: 12,
          border: '1px solid #E2E8F0', boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 12,
          maxWidth: 'calc(100vw - 24px)',
        }}>
          {/* Visual preview of the current brush — diameter scales with penSize. */}
          <div title={`Spessore ${penSize}px`} style={{
            width: 30, height: 30, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#F1F5F9', flexShrink: 0,
          }}>
            <div style={{ width: Math.max(2, Math.min(28, penSize)), height: Math.max(2, Math.min(28, penSize)), borderRadius: '50%', background: penColor }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569' }}>
            Spessore
            <input type="range" min={1} max={40} step={1} value={penSize}
              onChange={e => setPenSize(Number(e.target.value))}
              style={{ width: 100, accentColor: '#F28C28' }} />
            <span style={{ fontSize: 11, color: '#64748B', minWidth: 22, textAlign: 'right' }}>{penSize}</span>
          </label>
          <div style={{ width: 1, height: 22, background: '#E2E8F0' }} />
          <div title="Colore pennarello" style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 16px)', gap: 4,
          }}>
            {TEXT_COLOR_SWATCHES.map(c => (
              <button key={c} onClick={() => setPenColor(c)} style={{
                width: 16, height: 16, borderRadius: '50%', padding: 0,
                background: c, cursor: 'pointer',
                border: penColor === c ? '2px solid #F28C28' : '1px solid #CBD5E1',
              }} />
            ))}
          </div>
        </div>
      )}

      {/* Eraser options popover — just the brush size. */}
      {creativeMode && effectiveTool === 'eraser' && (
        <div onMouseDown={e => e.stopPropagation()} style={{
          position: 'absolute', top: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 19,
          padding: '8px 12px', background: 'rgba(255,255,255,0.97)', borderRadius: 12,
          border: '1px solid #E2E8F0', boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div title={`Diametro ${eraserSize}px`} style={{
            width: 30, height: 30, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#F1F5F9', flexShrink: 0,
          }}>
            <div style={{
              // Cap the preview swatch to the dial size — for large eraser values
              // (up to 500) we just render the maximum disc, the on-canvas circle
              // is the authoritative size indicator anyway.
              width: Math.max(4, Math.min(28, Math.sqrt(eraserSize) * 1.6)),
              height: Math.max(4, Math.min(28, Math.sqrt(eraserSize) * 1.6)),
              borderRadius: '50%', background: '#fff', border: '1.5px solid #64748B',
            }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#475569' }}>
            Diametro
            <input type="range" min={6} max={500} step={2} value={eraserSize}
              onChange={e => setEraserSize(Number(e.target.value))}
              style={{ width: 160, accentColor: '#F28C28' }} />
            <span style={{ fontSize: 11, color: '#64748B', minWidth: 28, textAlign: 'right' }}>{eraserSize}</span>
          </label>
        </div>
      )}

      {/* Eraser cursor preview — rendered in screen coords so the circle stays a
          constant diameter visually regardless of zoom. */}
      {creativeMode && effectiveTool === 'eraser' && eraserPos && (
        <div style={{
          position: 'absolute',
          left: eraserPos.x - (eraserSize * scale) / 2,
          top: eraserPos.y - (eraserSize * scale) / 2,
          width: eraserSize * scale, height: eraserSize * scale,
          borderRadius: '50%',
          border: '1.5px solid #475569', background: 'rgba(255,255,255,0.45)',
          pointerEvents: 'none', zIndex: 25,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.6)',
        }} />
      )}

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
          const highRes = rowWantsHighRes(y, cellH)
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
                {(() => {
                  // Per-task status bars, ordered by task status (todo → wip → review → done)
                  // so the visual flow reads left-to-right as work progresses.
                  const itemTasks = (getTasks ? getTasks(item) : []) || []
                  if (itemTasks.length === 0) {
                    return (
                      <div style={{ marginTop: 10, fontSize: 10, color: '#94A3B8', fontWeight: 500 }}>
                        Nessun task
                      </div>
                    )
                  }
                  const order = { todo: 0, wip: 1, review: 2, approved: 3 }
                  const sorted = [...itemTasks].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
                  // Counts per status for the inline summary chip
                  const counts = sorted.reduce((acc, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc }, {})
                  return (
                    <>
                      <div style={{ display: 'flex', gap: 3, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%' }}>
                        {sorted.map(t => {
                          const st = getTaskStatus(t.status)
                          const dLabel = (depts.find(d => d.id === t.department)?.label) || t.department || ''
                          return (
                            <div key={t.id}
                              title={`${dLabel}${t.task_label ? ' · ' + t.task_label : ''} — ${st.label}`}
                              style={{ width: 14, height: 6, borderRadius: 3, background: st.color, opacity: 0.95 }} />
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, fontSize: 9.5, fontWeight: 600, color: '#64748B' }}>
                        {TASK_STATUSES.map(st => counts[st.id] ? (
                          <span key={st.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.color }} />
                            {counts[st.id]}
                          </span>
                        ) : null)}
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Reference */}
              <div style={{ position: 'absolute', left: colX(1), top: 0, width: B_REF_W, height: cellH, overflow: 'hidden' }}>
                <RefCell url={getRefUrl(item)} onClick={() => openRef(item)} cellH={cellH} highRes={highRes} />
              </div>

              {/* Description — inner div has no height constraint so its natural height
                  drives the row sizing via ResizeObserver (descRef). */}
              <div style={{
                position: 'absolute', left: colX(2), top: 0,
                width: B_DESC_W, height: cellH,
                background: '#fff', borderRadius: 10, border: '1px solid #E8ECF1',
                padding: '12px 14px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}>
                <div ref={descRef(item.id)} style={{
                  fontSize: 12, color: description ? '#475569' : '#C8CDD4',
                  fontStyle: description ? 'normal' : 'italic',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word',
                }}>
                  {description || 'Nessuna descrizione'}
                </div>
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
                      measureRef={cellRef(item.id, d.id)} highRes={highRes}
                      onClickImage={(idx) => openCellImage(item.id, code, d.id, d.label, status, idx)} />
                  </div>
                )
              })}
            </div>
          )
        })}

        {/* Sticker layer — every kind EXCEPT strokes. Strokes live on a dedicated
            drawing-layer overlay (below) so they always sit on top of the rest of
            the board and aren't part of normal selection / chrome flows. */}
        {creativeMode && stickers.filter(s => s.kind !== 'stroke').map(sticker => (
          <StickerItem key={sticker.id} sticker={sticker} scale={scale}
            autoEdit={sticker.id === autoEditId}
            interactive={effectiveTool === 'select'}
            selected={selectedIds.has(sticker.id)}
            multiSelect={selectedIds.size > 1 && selectedIds.has(sticker.id)}
            onSelect={(opts) => selectSticker(sticker.id, opts)}
            onGroupDragStart={beginGroupDrag}
            onUpdate={(u) => onStickerUpdate(sticker.id, u)}
            onCommitUndo={onCommitUndo}
            onBringForward={() => onBringForward?.(sticker.id)}
            onSendBack={() => onSendBack?.(sticker.id)}
            onDelete={() => onStickerDelete(sticker.id)} />
        ))}

        {/* Group bounding box — visible only when a multi-selection is active.
            Provides the dashed outline + 8 resize handles for proportionally scaling
            every selected sticker as a unit (relative positions preserved). */}
        {groupBbox && (
          <div style={{
            position: 'absolute', left: groupBbox.x, top: groupBbox.y,
            width: groupBbox.w, height: groupBbox.h,
            outline: '2px dashed #F28C28', borderRadius: 4,
            pointerEvents: 'none', zIndex: 9998,
          }}>
            {RESIZE_HANDLES.map(h => (
              <div key={h.c} onMouseDown={e => beginGroupResize(e, h.c)} style={{
                position: 'absolute', width: 14, height: 14,
                background: '#fff', border: '2px solid #F28C28', borderRadius: 3,
                cursor: h.cursor,
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                pointerEvents: 'auto',
                ...h.pos,
              }} />
            ))}
          </div>
        )}

        {/* Marquee (live drag rectangle while box-selecting). */}
        {marquee && (() => {
          const mx = Math.min(marquee.sx, marquee.ex)
          const my = Math.min(marquee.sy, marquee.ey)
          const mw = Math.abs(marquee.ex - marquee.sx)
          const mh = Math.abs(marquee.ey - marquee.sy)
          return (
            <div style={{
              position: 'absolute', left: mx, top: my, width: mw, height: mh,
              border: '1.5px solid #F28C28', background: 'rgba(242,140,40,0.10)',
              pointerEvents: 'none', borderRadius: 2, zIndex: 9997,
            }} />
          )
        })()}

        {/* Stroke selection bbox — shown while the Sposta-disegno tool is active
            and at least one stroke is selected. Lives above the drawing layer
            (zIndex 100001 vs 99999) so the dashed outline is visible over the ink. */}
        {effectiveTool === 'strokemove' && strokeGroupBbox && (
          <div style={{
            position: 'absolute',
            left: strokeGroupBbox.x, top: strokeGroupBbox.y,
            width: strokeGroupBbox.w, height: strokeGroupBbox.h,
            border: '2px dashed #F28C28', borderRadius: 4,
            background: 'rgba(242,140,40,0.04)',
            pointerEvents: 'none', zIndex: 100001,
          }} />
        )}

        {/* Stroke marquee — live drag rectangle while area-selecting strokes. */}
        {strokeMarquee && (() => {
          const mx = Math.min(strokeMarquee.sx, strokeMarquee.ex)
          const my = Math.min(strokeMarquee.sy, strokeMarquee.ey)
          const mw = Math.abs(strokeMarquee.ex - strokeMarquee.sx)
          const mh = Math.abs(strokeMarquee.ey - strokeMarquee.sy)
          return (
            <div style={{
              position: 'absolute', left: mx, top: my, width: mw, height: mh,
              border: '1.5px solid #F28C28', background: 'rgba(242,140,40,0.10)',
              pointerEvents: 'none', borderRadius: 2, zIndex: 100000,
            }} />
          )
        })()}

        {/* Drawing layer — ONE big SVG overlay that holds every pen stroke on the
            board plus the live preview. Always rendered above every sticker so the
            ink behaves like marks on a single transparent sheet stretched over the
            whole board. pointerEvents: none so it never intercepts clicks — strokes
            are intentionally not selectable, they're modified exclusively by the
            pen (which appends) and the eraser (which cuts points). */}
        {creativeMode && (
          <svg width={boardW} height={boardH} viewBox={`0 0 ${boardW} ${boardH}`}
            shapeRendering="geometricPrecision"
            style={{
              position: 'absolute', left: 0, top: 0,
              pointerEvents: 'none', zIndex: 99999, overflow: 'visible',
              // Promote to its own compositor layer so the browser re-rasterises
              // it at the parent's CSS scale (otherwise the SVG is painted at
              // 1x and bitmap-upscaled when the user zooms in, which is what
              // produces the residual stairstep on thin strokes).
              willChange: 'transform',
              transform: 'translateZ(0)',
            }}>
            {stickers.filter(s => s.kind === 'stroke').map(s => {
              const data = parseStroke(s.text_content)
              if (!data || data.segments.length === 0) return null
              // If the user has resized the underlying sticker (unlikely now that
              // strokes aren't directly selectable, but legacy data may exist),
              // scale the points into the current bbox.
              const sxScale = s.w / Math.max(data.w, 1)
              const syScale = s.h / Math.max(data.h, 1)
              return data.segments.map((seg, i) => {
                const absPts = seg.map(([x, y]) => [s.x + x * sxScale, s.y + y * syScale])
                return (
                  <path key={`${s.id}-${i}`} d={smoothPath(absPts)}
                    fill="none"
                    stroke={s.text_color || '#1a1a1a'}
                    strokeWidth={s.font_size || 4}
                    strokeLinecap="round" strokeLinejoin="round" />
                )
              })
            })}
            {/* Live pen stroke: same layer, same smoothing, so the moment the
                user releases the pen the preview line BECOMES the persisted
                sticker without any visual swap. */}
            {livePath && livePath.points.length > 0 && (
              <path d={smoothPath(livePath.points)} fill="none"
                stroke={penColor} strokeWidth={penSize}
                strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        )}

        {/* Drawing preview while a drawing tool is being dragged */}
        {draft && (() => {
          const x = Math.min(draft.sx, draft.ex), y = Math.min(draft.sy, draft.ey)
          const w = Math.abs(draft.ex - draft.sx), h = Math.abs(draft.ey - draft.sy)
          if (draft.kind === 'arrow') {
            const pad = 14
            return (
              <svg style={{ position: 'absolute', left: x - pad, top: y - pad, pointerEvents: 'none' }}
                width={w + pad * 2} height={h + pad * 2}
                viewBox={`${-pad} ${-pad} ${w + pad * 2} ${h + pad * 2}`}>
                <defs>
                  <marker id="draft-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M0,0 L10,5 L0,10 z" fill="#F28C28" />
                  </marker>
                </defs>
                <line
                  x1={draft.ex >= draft.sx ? 0 : w}
                  y1={draft.ey >= draft.sy ? 0 : h}
                  x2={draft.ex >= draft.sx ? w : 0}
                  y2={draft.ey >= draft.sy ? h : 0}
                  stroke="#F28C28" strokeWidth={3} strokeDasharray="6 4" strokeLinecap="round" markerEnd="url(#draft-ah)" />
              </svg>
            )
          }
          return (
            <div style={{
              position: 'absolute', left: x, top: y, width: w, height: h,
              border: '2px dashed #F28C28',
              borderRadius: draft.kind === 'ellipse' ? '50%' : 6,
              background: 'rgba(242,140,40,0.06)', pointerEvents: 'none',
            }} />
          )
        })()}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════
// STICKER ITEM — draggable, resizable, rotatable (image or text)
// ══════════════════════════════════════════════════

// Stroke / text / border colour swatches. Top row = grey ramp (dark → light → white),
// bottom row = saturated accents. The grey ramp makes shape borders soft by default
// without forcing pure black.
const TEXT_COLOR_SWATCHES = [
  '#1a1a1a', '#334155', '#475569', '#64748B', '#94A3B8', '#CBD5E1', '#FFFFFF',
  '#EF4444', '#F59E0B', '#FDE047', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899',
]
// Broader palette: transparent, neutrals, soft pastels and saturated accents.
// Arranged so the swatch grid in the toolbar reads top-to-bottom by tone.
const TEXT_BG_SWATCHES = [
  'transparent', '#FFFFFF', '#F1F5F9', '#CBD5E1', '#64748B', '#1F2937',
  '#FEF3C7', '#FED7AA', '#FECACA', '#FBCFE8', '#DDD6FE', '#BFDBFE', '#BBF7D0', '#A7F3D0',
  '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#3B82F6', '#10B981',
]

// Convert a hex colour string to rgba with a user-supplied alpha. Used to apply the
// shape opacity slider to the fill ONLY — leaves border and label at full opacity,
// which is the usual behaviour in design tools.
function hexToRgba(hex, alpha) {
  if (!hex || hex === 'transparent') return 'transparent'
  if (alpha == null || alpha >= 1) return hex
  let h = hex.startsWith('#') ? hex.slice(1) : hex
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const m = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h)
  if (!m) return hex
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16)
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`
}

// Pen-stroke storage format:
//   { w, h, segs: [[[x,y],...], ...] }
// `segs` is an array of sub-polylines (allows gaps from the eraser to cut a single
// drawn stroke into multiple visible segments without splitting it into separate
// stickers). `w`/`h` is the AUTHORITATIVE natural extent used as the SVG viewBox —
// stored alongside the points so partial-erasure (which shrinks the visible content)
// can't accidentally rescale what's left.
// Legacy formats are auto-upgraded on read:
//   - flat array          [[x,y], ...]           → one sub-polyline
//   - bare nested array   [[[x,y],...], ...]     → segs, w/h derived from max point
function parseStroke(text) {
  let v
  try { v = JSON.parse(text || '[]') } catch { return null }
  if (v && !Array.isArray(v) && Array.isArray(v.segs)) {
    return { w: v.w || 1, h: v.h || 1, segments: v.segs }
  }
  if (!Array.isArray(v) || v.length === 0) return null
  const segments = Array.isArray(v[0]) && typeof v[0][0] === 'number' ? [v] : v
  let maxX = 0, maxY = 0
  for (const seg of segments) for (const [x, y] of seg) {
    if (x > maxX) maxX = x; if (y > maxY) maxY = y
  }
  return { w: maxX || 1, h: maxY || 1, segments }
}

// Convert a polyline (sampled points) into a smooth SVG path using quadratic
// Bezier curves through midpoints. Each segment's control point IS the original
// sample — the curve passes through midpoints between successive samples so the
// result is C¹-continuous (no visible kinks) and rounds out the staircase pattern
// you get from raw mousemove samples. Returns a `d` attribute string.
function smoothPath(points) {
  if (!points || points.length < 2) return ''
  if (points.length === 2) {
    return `M${points[0][0]},${points[0][1]} L${points[1][0]},${points[1][1]}`
  }
  let d = `M${points[0][0]},${points[0][1]}`
  for (let i = 1; i < points.length - 1; i++) {
    const cx = points[i][0], cy = points[i][1]
    const mx = (cx + points[i + 1][0]) / 2
    const my = (cy + points[i + 1][1]) / 2
    d += ` Q${cx},${cy} ${mx},${my}`
  }
  const last = points[points.length - 1]
  d += ` L${last[0]},${last[1]}`
  return d
}

// Split a stroke's sub-polylines wherever a point falls within the eraser disc.
// `isHit(x, y)` is called in the stroke's LOCAL coordinate space (same as the
// stored points). Returns a new segments array; never mutates the input.
function eraseSegmentsByHit(segments, isHit) {
  const out = []
  for (const seg of segments) {
    let cur = []
    for (const pt of seg) {
      if (isHit(pt[0], pt[1])) {
        if (cur.length >= 2) out.push(cur)
        cur = []
      } else {
        cur.push(pt)
      }
    }
    if (cur.length >= 2) out.push(cur)
  }
  return out
}

// 8-handle resize map: 4 corners + 4 sides. Each handle's drag affects only the relevant
// edge(s), with the opposite edge anchored. Free resize (no aspect lock) — feels natural
// because the dragged handle follows the cursor exactly on both axes.
const RESIZE_HANDLES = [
  { c: 'tl', cursor: 'nwse-resize', pos: { top: -7, left: -7 } },
  { c: 'tr', cursor: 'nesw-resize', pos: { top: -7, right: -7 } },
  { c: 'bl', cursor: 'nesw-resize', pos: { bottom: -7, left: -7 } },
  { c: 'br', cursor: 'nwse-resize', pos: { bottom: -7, right: -7 } },
  { c: 't',  cursor: 'ns-resize',   pos: { top: -7, left: 'calc(50% - 7px)' } },
  { c: 'r',  cursor: 'ew-resize',   pos: { top: 'calc(50% - 7px)', right: -7 } },
  { c: 'b',  cursor: 'ns-resize',   pos: { bottom: -7, left: 'calc(50% - 7px)' } },
  { c: 'l',  cursor: 'ew-resize',   pos: { top: 'calc(50% - 7px)', left: -7 } },
]

// Compact rotation cursor — small curved arrow with arrowhead, white halo for contrast
// on any background. 16×16 footprint with hotspot at the visual centre.
const ROTATE_CURSOR_SVG = "<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'><path stroke='white' stroke-width='2.6' fill='none' stroke-linecap='round' stroke-linejoin='round' d='M12.5 8 A 4.5 4.5 0 1 1 8 3.5 L 8 1 L 5.5 3.5 L 8 6'/><path stroke='%230f172a' stroke-width='1.2' fill='none' stroke-linecap='round' stroke-linejoin='round' d='M12.5 8 A 4.5 4.5 0 1 1 8 3.5 L 8 1 L 5.5 3.5 L 8 6'/></svg>"
const ROTATE_CURSOR = `url("data:image/svg+xml;utf8,${ROTATE_CURSOR_SVG}") 8 8, crosshair`

// Rotation zones — pushed clearly OUTSIDE the corner so there's a generous dead-zone
// between the resize handle and the rotation area. The rotate cursor appears only when
// the cursor is noticeably past the corner.
const ROTATE_ZONES = [
  { c: 'tl', pos: { top: -44, left: -44, width: 32, height: 32 } },
  { c: 'tr', pos: { top: -44, right: -44, width: 32, height: 32 } },
  { c: 'bl', pos: { bottom: -44, left: -44, width: 32, height: 32 } },
  { c: 'br', pos: { bottom: -44, right: -44, width: 32, height: 32 } },
]

// Cloudinary fetch buckets for image stickers. Quantized so we don't refetch
// on every wheel tick when zooming, and we cap at 4096 to keep bandwidth sane
// even when someone zooms way in on a giant contact-sheet sticker.
//
// HEADROOM=1.5 oversamples the screen size so the image stays crisp even as
// the user zooms a bit further before we cross the next bucket boundary.
// MIN_BUCKET=1024 keeps initial paint sharp on small stickers that the user
// then resizes upward (the previous 512 default was just barely enough for a
// half-screen sticker on retina, so any further zoom blurred it).
const STICKER_BUCKETS = [1024, 2048, 4096]
const STICKER_HEADROOM = 1.5
function pickStickerBucket(stickerW, stickerH, canvasScale) {
  const dpr = typeof window !== 'undefined'
    ? Math.min(3, Math.max(1, Math.ceil(window.devicePixelRatio || 1)))
    : 2
  const longest = Math.max(stickerW || 0, stickerH || 0, 1)
  const target = Math.ceil(longest * (canvasScale || 1) * dpr * STICKER_HEADROOM)
  return STICKER_BUCKETS.find(b => b >= target) ?? STICKER_BUCKETS[STICKER_BUCKETS.length - 1]
}

function StickerItem({ sticker, scale, onUpdate, onDelete, onBringForward, onSendBack, onCommitUndo, autoEdit, selected, onSelect, multiSelect, onGroupDragStart, onGroupDragMove, onGroupDragEnd, interactive = true }) {
  const isImage = sticker.kind === 'image' || !sticker.kind
  const isText = sticker.kind === 'text'
  const isRect = sticker.kind === 'rect'
  const isEllipse = sticker.kind === 'ellipse'
  const isShape = isRect || isEllipse
  const isArrow = sticker.kind === 'arrow'
  const isStroke = sticker.kind === 'stroke'

  // Adaptive Cloudinary resolution for image stickers — see pickStickerBucket().
  // Crucially we only ever bump UP: the browser keeps the higher-res copy in
  // its image cache, so zooming back out doesn't trigger a fetch downgrade and
  // the image still looks crisp at the smaller size.
  const [imgBucket, setImgBucket] = useState(() => isImage ? pickStickerBucket(sticker.w, sticker.h, scale) : STICKER_BUCKETS[1])
  useEffect(() => {
    if (!isImage) return
    const next = pickStickerBucket(sticker.w, sticker.h, scale)
    setImgBucket(prev => (next > prev ? next : prev))
  }, [isImage, sticker.w, sticker.h, scale])

  const [editing, setEditing] = useState(!!autoEdit && isText)
  const [action, setAction] = useState(null) // 'drag' | 'resize' | 'rotate' | 'endpoint'
  const startRef = useRef(null)
  const elRef = useRef(null)
  const textRef = useRef(null)
  const latestRef = useRef(sticker)
  latestRef.current = sticker

  // When tool switches away from Select, close any open inline text editor (so it
  // saves cleanly). Selection itself is owned by the parent (CanvasBoard).
  useEffect(() => {
    if (!interactive) setEditing(false)
  }, [interactive])

  // autoEdit can re-arm after the sticker is first created (text added). The parent
  // clears it shortly after — entering the inline editor is purely a UX nicety.
  useEffect(() => {
    if (autoEdit && isText) setEditing(true)
  }, [autoEdit, isText])

  // Captures the sticker's state BEFORE an interactive action (drag / resize / rotate /
  // endpoint) so we can push a single 'update' undo entry on mouseup — one entry per
  // user gesture, not per pixel.
  const actionBeforeRef = useRef(null)
  const snapshotBefore = () => {
    const s = latestRef.current
    actionBeforeRef.current = { x: s.x, y: s.y, w: s.w, h: s.h, rotation: s.rotation || 0 }
  }

  const beginDrag = (e) => {
    // If the canvas isn't in select mode (hand / drawing tool / space-to-pan), let the
    // mousedown bubble to the canvas — the user wants to pan or draw, not select.
    if (!interactive) return
    if (editing) return
    // Right-click is reserved for panning the canvas; let it bubble.
    if (e.button === 2) return
    e.stopPropagation(); e.preventDefault()
    const additive = e.shiftKey || e.metaKey || e.ctrlKey
    // Shift/Ctrl click: toggle membership, no drag.
    if (additive) { onSelect?.({ additive: true }); return }
    // If the sticker is already part of a multi-selection, drag the whole group.
    if (multiSelect) {
      onGroupDragStart?.(e)
      return
    }
    // Otherwise: this is the only selected sticker → standard single drag.
    onSelect?.({ additive: false })
    const s = latestRef.current
    startRef.current = { mx: e.clientX, my: e.clientY, x: s.x, y: s.y, w: s.w, h: s.h }
    snapshotBefore()
    setAction('drag')
  }

  const beginResize = (e, handle) => {
    e.stopPropagation(); e.preventDefault()
    const s = latestRef.current
    startRef.current = { handle, mx: e.clientX, my: e.clientY, x: s.x, y: s.y, w: s.w, h: s.h }
    snapshotBefore()
    setAction('resize')
  }

  const beginRotate = (e) => {
    e.stopPropagation(); e.preventDefault()
    if (!elRef.current) return
    const rect = elRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    // Capture the angle the mouse currently makes with the centre AND the sticker's
    // current rotation. New rotation = startRotation + (cursor angle delta) — no snap.
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI)
    startRef.current = { cx, cy, startAngle, startRotation: latestRef.current.rotation || 0 }
    snapshotBefore()
    setAction('rotate')
  }

  // Arrow endpoint dragging: 'start' moves (x,y) and keeps the end fixed by adjusting w/h;
  // 'end' moves (x+w, y+h) by adjusting w/h while keeping (x,y) fixed.
  const beginEndpoint = (e, which) => {
    e.stopPropagation(); e.preventDefault()
    const s = latestRef.current
    startRef.current = { which, mx: e.clientX, my: e.clientY, x: s.x, y: s.y, w: s.w, h: s.h }
    snapshotBefore()
    setAction('endpoint')
  }

  useEffect(() => {
    if (!action) return
    const MIN_W = 40, MIN_H = 28
    const onMove = (e) => {
      const st = startRef.current; if (!st) return
      if (action === 'drag') {
        const dx = (e.clientX - st.mx) / scale, dy = (e.clientY - st.my) / scale
        onUpdate({ x: Math.round(st.x + dx), y: Math.round(st.y + dy) })
      } else if (action === 'resize') {
        const dx = (e.clientX - st.mx) / scale, dy = (e.clientY - st.my) / scale
        const h = st.handle
        let nx = st.x, ny = st.y, nw = st.w, nh = st.h

        // Images keep a fixed aspect ratio — corner drag is locked to the original
        // ratio so the picture is only scaled, never stretched. The orientation of
        // the dominant axis (Δx vs Δy) decides which dimension leads the resize.
        if (isImage && (h === 'tl' || h === 'tr' || h === 'bl' || h === 'br')) {
          const ar = st.w / Math.max(st.h, 1)
          const sx = (h === 'br' || h === 'tr') ? 1 : -1 // horizontal sign
          const sy = (h === 'br' || h === 'bl') ? 1 : -1 // vertical sign
          // Project both axes onto the same "width-equivalent" measure to compare.
          const dxw = sx * dx
          const dyw = sy * dy * ar
          const eff = Math.abs(dxw) > Math.abs(dyw) ? dxw : dyw
          nw = Math.round(Math.max(MIN_W, st.w + eff))
          nh = Math.round(nw / ar)
          if (sx < 0) nx = st.x + st.w - nw // anchored right edge
          if (sy < 0) ny = st.y + st.h - nh // anchored bottom edge
          onUpdate({ x: nx, y: ny, w: nw, h: nh })
          return
        }

        // Round nw FIRST and derive nx from the rounded value so the anchored edge
        // stays pixel-exact (st.x + st.w == nx + nw always, no sub-pixel wobble).
        if (h === 'br' || h === 'tr' || h === 'r') {
          nw = Math.round(Math.max(MIN_W, st.w + dx))
        } else if (h === 'bl' || h === 'tl' || h === 'l') {
          nw = Math.round(Math.max(MIN_W, st.w - dx))
          nx = st.x + st.w - nw
        }
        if (h === 'br' || h === 'bl' || h === 'b') {
          nh = Math.round(Math.max(MIN_H, st.h + dy))
        } else if (h === 'tr' || h === 'tl' || h === 't') {
          nh = Math.round(Math.max(MIN_H, st.h - dy))
          ny = st.y + st.h - nh
        }
        onUpdate({ x: nx, y: ny, w: nw, h: nh })
      } else if (action === 'rotate') {
        const cur = Math.atan2(e.clientY - st.cy, e.clientX - st.cx) * (180 / Math.PI)
        let deg = st.startRotation + (cur - st.startAngle)
        if (e.shiftKey) deg = Math.round(deg / 15) * 15 // hold Shift to snap to 15°
        onUpdate({ rotation: Math.round(deg) })
      } else if (action === 'endpoint') {
        const dx = (e.clientX - st.mx) / scale, dy = (e.clientY - st.my) / scale
        if (st.which === 'start') {
          // Move start point; keep end fixed by adjusting w/h.
          const nx = Math.round(st.x + dx), ny = Math.round(st.y + dy)
          onUpdate({ x: nx, y: ny, w: Math.round(st.w - dx), h: Math.round(st.h - dy) })
        } else {
          // Move end point; keep start (x,y) fixed.
          onUpdate({ w: Math.round(st.w + dx), h: Math.round(st.h + dy) })
        }
      }
    }
    const onUp = () => {
      // One undo entry per gesture: compare end-of-action state vs the snapshot we
      // took at mousedown, and push 'update' only if anything actually changed.
      const before = actionBeforeRef.current
      const s = latestRef.current
      if (before && s && (before.x !== s.x || before.y !== s.y || before.w !== s.w || before.h !== s.h || (before.rotation || 0) !== (s.rotation || 0))) {
        onCommitUndo?.({ type: 'update', id: sticker.id, before })
      }
      actionBeforeRef.current = null
      setAction(null)
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [action, scale, onUpdate, onCommitUndo, sticker.id])

  // When the parent removes this sticker from the selection (click on background,
  // marquee, etc.), close the inline text editor and commit any pending text edit so
  // we don't drop the user's last keystrokes. We ALSO explicitly blur the
  // contenteditable — otherwise document.activeElement keeps pointing at it after
  // contentEditable flips false, and on macOS that hijacks Cmd+Z as "undo typing"
  // (the browser's native edit-menu shortcut takes precedence over our handler).
  useEffect(() => {
    if (selected) return
    if (editing && textRef.current) {
      const next = textRef.current.innerText
      if (next !== (sticker.text_content || '')) onUpdate({ text_content: next })
      setEditing(false)
    }
    if (textRef.current && document.activeElement === textRef.current) {
      textRef.current.blur()
    }
  }, [selected, editing, onUpdate, sticker.text_content])

  // Delete key removes the sticker when selected solo (not editing). Multi-selection
  // delete is handled by CanvasBoard so all selected stickers go together.
  useEffect(() => {
    if (!selected || editing || multiSelect) return
    const onKey = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onDelete() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, editing, multiSelect, onDelete])

  // Sync external text changes (initial mount, realtime updates) into the contenteditable
  // WITHOUT touching it while the user is actively editing (would clobber the caret).
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    if (document.activeElement === el) return
    const want = sticker.text_content || ''
    if (el.innerText !== want) el.innerText = want
  }, [sticker.text_content])

  // Autofocus when entering edit mode and place caret at end
  useEffect(() => {
    if (!editing || !textRef.current) return
    textRef.current.focus()
    const sel = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(textRef.current)
    range.collapse(false)
    sel.removeAllRanges(); sel.addRange(range)
  }, [editing])

  // Show full chrome (resize/rotate handles, toolbars) only when this sticker is the
  // sole selection. In a multi-selection, only the dashed outline appears — the group
  // bounding box (rendered by CanvasBoard) provides the unified resize/move affordance.
  const show = selected
  const showHandles = selected && !multiSelect

  // Container box. Arrows may have negative w/h (direction-bearing deltas) so we flip
  // the top-left and use absolute dimensions for the actual rendered box.
  let cx = sticker.x, cy = sticker.y
  let cw = isArrow ? Math.abs(sticker.w) : sticker.w
  let ch = isArrow ? Math.abs(sticker.h) : sticker.h
  if (isArrow) {
    if (sticker.w < 0) cx = sticker.x + sticker.w
    if (sticker.h < 0) cy = sticker.y + sticker.h
    // Ensure the bounding box has at least some clickable area
    cw = Math.max(cw, 4)
    ch = Math.max(ch, 4)
  }

  // Stable normal z-index for the content layer. Selection no longer hoists the
  // sticker to the top — the chrome (handles, toolbars, outline) is rendered in a
  // SEPARATE overlay layer at a very high z-index, so the user can still see the
  // sticker's real depth-order while bringing it forward/backward.
  const contentZ = 1000 + (sticker.z_index || 0)
  const chromeZ = 9999

  return (<>
    <div ref={elRef}
      onMouseDown={beginDrag}
      onDoubleClick={isText ? (e) => { e.stopPropagation(); onSelect?.({ additive: false }); setEditing(true) } : undefined}
      style={{
        position: 'absolute', left: cx, top: cy, width: cw, height: ch,
        transform: `rotate(${sticker.rotation || 0}deg)`,
        // Cursor convention:
        // - editing text → text caret
        // - dragging (mouse held) → grabbing (4-arrow "moving" feel)
        // - hovering an interactive sticker → arrow (default), so the user knows
        //   "this is an object I can click/drag" — distinct from the canvas hand
        //   cursor which means "click here to pan"
        // - hand mode (interactive=false) → grab so it matches the canvas
        cursor: editing ? 'text' : action === 'drag' ? 'grabbing' : interactive ? 'default' : 'grab',
        zIndex: contentZ,
        borderRadius: 4,
        // For arrows: don't let the rectangular bounding box catch clicks. Only the
        // SVG line + endpoint handles + action toolbar should be interactive, so the
        // user can't accidentally select a diagonal arrow by clicking empty space
        // inside its bounding rectangle.
        pointerEvents: isArrow ? 'none' : undefined,
      }}>
      {isImage && (
        <Img
          src={sticker.image_url}
          w={imgBucket}
          h={imgBucket}
          fit="limit"
          alt=""
          draggable={false}
          onLoad={(e) => {
            const nw = e.currentTarget.naturalWidth
            const nh = e.currentTarget.naturalHeight
            if (!nw || !nh) return
            const cur = sticker.w / Math.max(sticker.h, 1)
            const nat = nw / nh
            if (Math.abs(cur - nat) < 0.02) return
            const next = sticker.w >= sticker.h
              ? { w: sticker.w, h: Math.round(sticker.w / nat) }
              : { h: sticker.h, w: Math.round(sticker.h * nat) }
            onUpdate(next)
          }}
          style={{ width: '100%', height: '100%', objectFit: 'fill', pointerEvents: 'none', userSelect: 'none', display: 'block', borderRadius: 4 }} />
      )}

      {isText && (
        <div
          ref={textRef}
          contentEditable={editing}
          suppressContentEditableWarning
          onInput={(e) => {
            const next = e.currentTarget.innerText
            if (next !== sticker.text_content) onUpdate({ text_content: next })
          }}
          onBlur={(e) => {
            const next = e.currentTarget.innerText
            setEditing(false)
            if (next !== sticker.text_content) onUpdate({ text_content: next })
          }}
          onMouseDown={editing ? (e) => e.stopPropagation() : undefined}
          style={{
            width: '100%', height: '100%',
            background: sticker.bg_color || 'transparent',
            color: sticker.text_color || '#1a1a1a',
            fontSize: sticker.font_size || 18, lineHeight: 1.35,
            fontWeight: 600, padding: '8px 12px', boxSizing: 'border-box',
            borderRadius: 8, outline: editing ? '2px solid #F28C28' : 'none',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            overflow: 'hidden',
            userSelect: editing ? 'text' : 'none',
            WebkitUserSelect: editing ? 'text' : 'none',
            cursor: editing ? 'text' : 'inherit',
            boxShadow: (sticker.bg_color && sticker.bg_color !== 'transparent') ? '0 2px 8px rgba(0,0,0,0.12)' : 'none',
          }}
        />
      )}

      {isStroke && (() => {
        // Pen stroke. Stored as a list of sub-polylines (gaps allowed) so the
        // eraser can cut a stroke into pieces without splitting it across
        // multiple stickers. viewBox is pinned to the original natural extent so
        // partial erasure or sticker resize never warps what's left.
        const data = parseStroke(sticker.text_content)
        if (!data || data.segments.length === 0) return null
        return (
          <svg width={cw} height={ch} viewBox={`0 0 ${data.w} ${data.h}`}
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
            {data.segments.map((seg, i) => (
              <polyline key={i}
                points={seg.map(([px, py]) => `${px},${py}`).join(' ')}
                fill="none"
                stroke={sticker.text_color || '#1a1a1a'}
                strokeWidth={sticker.font_size || 4}
                strokeLinecap="round" strokeLinejoin="round"
                vectorEffect="non-scaling-stroke" />
            ))}
          </svg>
        )
      })()}

      {isShape && (
        // Pure visual frame: fill + border + soft outer shadow. No text — the user
        // adds text with the dedicated Text tool. Fill alpha comes from sticker.opacity
        // via rgba so the border stays crisp.
        <div style={{
          width: '100%', height: '100%',
          background: hexToRgba(sticker.bg_color ?? '#FFFFFF', typeof sticker.opacity === 'number' ? sticker.opacity : 1),
          border: `${sticker.border_width ?? 2}px solid ${sticker.text_color || '#1a1a1a'}`,
          borderRadius: isEllipse ? '50%' : 10,
          boxSizing: 'border-box',
          boxShadow: '0 2px 10px rgba(15,23,42,0.10)',
        }} />
      )}

      {isArrow && (() => {
        // Arrow line in container coords. The mounting point (cx,cy) is min(x, x+w),
        // so the start is at whichever corner reflects the (originally signed) deltas.
        const sx = sticker.w < 0 ? Math.abs(sticker.w) : 0
        const sy = sticker.h < 0 ? Math.abs(sticker.h) : 0
        const ex = sticker.w < 0 ? 0 : cw
        const ey = sticker.h < 0 ? 0 : ch
        const stroke = sticker.text_color || '#1a1a1a'
        const sw = sticker.font_size || 3
        const markerId = `ah-${sticker.id}`
        // Extra padding to allow the arrowhead to render outside the line stroke
        const PAD = Math.max(10, sw * 3)
        return (
          <svg
            width={cw + PAD * 2}
            height={ch + PAD * 2}
            viewBox={`${-PAD} ${-PAD} ${cw + PAD * 2} ${ch + PAD * 2}`}
            style={{ position: 'absolute', left: -PAD, top: -PAD, overflow: 'visible', pointerEvents: 'none' }}>
            <defs>
              <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={stroke} />
              </marker>
            </defs>
            {/* Invisible thick stroke for easy hit-testing — disabled while a non-select
                tool is active so panning / drawing isn't blocked by the arrow's hit area. */}
            <line x1={sx} y1={sy} x2={ex} y2={ey}
              stroke="transparent" strokeWidth={Math.max(16, sw * 4)}
              strokeLinecap="round"
              style={{ pointerEvents: interactive ? 'stroke' : 'none', cursor: interactive ? 'default' : 'grab' }}
              onMouseDown={beginDrag} />
            {/* Visible arrow */}
            <line x1={sx} y1={sy} x2={ex} y2={ey}
              stroke={stroke} strokeWidth={sw} strokeLinecap="round"
              markerEnd={`url(#${markerId})`}
              style={{ pointerEvents: 'none' }} />
            {/* Dashed selection guide (selected only) */}
            {show && <line x1={sx} y1={sy} x2={ex} y2={ey}
              stroke="#F28C28" strokeWidth={Math.max(1, sw + 1)} strokeDasharray="6 4"
              strokeLinecap="round" opacity="0.6" style={{ pointerEvents: 'none' }} />}
          </svg>
        )
      })()}

    </div>

    {/* Chrome overlay — sits at a very high z-index in a SEPARATE wrapper so the
        selection outline, handles and toolbars stay above every other sticker, while
        the sticker's content itself stays at its real z-order (the user can still tell
        what's in front and what's behind when bringing forward / sending back).
        Positioned identically to the content layer so handles line up; rotated with
        the same angle. pointer-events: none on the wrapper so it doesn't steal clicks
        in empty corners — interactive children override to auto. */}
    {show && <div style={{
      position: 'absolute', left: cx, top: cy, width: cw, height: ch,
      transform: `rotate(${sticker.rotation || 0}deg)`,
      zIndex: chromeZ,
      pointerEvents: 'none',
      outline: !isArrow ? `2px ${showHandles ? 'solid' : 'dashed'} #F28C28` : 'none',
      borderRadius: 4,
    }}>
        {!isArrow && showHandles && <>
          {/* Rotation zones — invisible squares in the outer quadrant of each corner. */}
          {ROTATE_ZONES.map(r => (
            <div key={'rot-' + r.c} onMouseDown={beginRotate} style={{
              position: 'absolute', cursor: ROTATE_CURSOR,
              background: 'transparent', zIndex: 5,
              pointerEvents: 'auto',
              ...r.pos,
            }} />
          ))}
          {/* Resize handles — images keep a fixed aspect ratio, so only the 4 corners
              are shown (side handles would imply stretching). Text, shapes, etc. get
              the full 8 handles (corners + sides) for free resize. */}
          {RESIZE_HANDLES
            .filter(h => !isImage || ['tl','tr','bl','br'].includes(h.c))
            .map(h => (
              <div key={h.c} onMouseDown={e => beginResize(e, h.c)} style={{
                position: 'absolute', width: 14, height: 14,
                background: '#fff', border: '2px solid #F28C28', borderRadius: 3,
                cursor: h.cursor,
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)', zIndex: 10,
                pointerEvents: 'auto',
                ...h.pos,
              }} />
            ))}
        </>}

        {isArrow && showHandles && (() => {
          // Endpoint handles at the actual start and end of the arrow within the box.
          const sx = sticker.w < 0 ? Math.abs(sticker.w) : 0
          const sy = sticker.h < 0 ? Math.abs(sticker.h) : 0
          const ex = sticker.w < 0 ? 0 : cw
          const ey = sticker.h < 0 ? 0 : ch
          const handleStyle = (xPos, yPos) => ({
            position: 'absolute', left: xPos - 9, top: yPos - 9, width: 18, height: 18,
            background: '#fff', border: '2.5px solid #F28C28', borderRadius: '50%',
            cursor: 'move', boxShadow: '0 2px 6px rgba(0,0,0,0.3)', zIndex: 20,
            // Re-enable hit-testing — the container has pointer-events:none for arrows
            // so the empty bounding box isn't clickable.
            pointerEvents: 'auto',
          })
          return <>
            <div onMouseDown={(e) => beginEndpoint(e, 'start')} style={handleStyle(sx, sy)} />
            <div onMouseDown={(e) => beginEndpoint(e, 'end')} style={handleStyle(ex, ey)} />
          </>
        })()}

        {/* Actions toolbar — Bring forward / Send back / Delete. Sits inside the box
            top-right for images/text/shapes, near the arrowhead for arrows. The whole
            toolbar counter-rotates so icons stay upright when the sticker is rotated.
            Hidden in multi-selection — group operations live on the marquee chrome. */}
        {showHandles && <div onMouseDown={(e) => e.stopPropagation()} style={{
          position: 'absolute',
          ...(isArrow
            ? { left: (sticker.w < 0 ? 0 : cw) + 12, top: (sticker.h < 0 ? 0 : ch) + 12 }
            : { top: 6, right: 6 }),
          display: 'flex', gap: 4, alignItems: 'center', zIndex: 30,
          transform: sticker.rotation ? `rotate(${-sticker.rotation}deg)` : undefined,
          transformOrigin: 'center center',
          pointerEvents: 'auto', // override container's pointer-events:none on arrows
        }}>
          <button onClick={() => onSendBack?.()} title="Manda dietro (Ctrl+[)"
            style={actionChipStyle('#fff', '#475569')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="4" width="11" height="11" rx="1.5" fill="currentColor" opacity="0.25" />
              <rect x="9" y="9" width="11" height="11" rx="1.5" />
            </svg>
          </button>
          <button onClick={() => onBringForward?.()} title="Porta avanti (Ctrl+])"
            style={actionChipStyle('#fff', '#475569')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="4" width="11" height="11" rx="1.5" />
              <rect x="9" y="9" width="11" height="11" rx="1.5" fill="currentColor" opacity="0.25" />
            </svg>
          </button>
          {isImage && sticker.image_url && (
            <button onClick={() => downloadImage(sticker.image_url)} title="Scarica immagine"
              style={actionChipStyle('#fff', '#475569')}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <path d="M7 10l5 5 5-5" />
                <path d="M12 15V3" />
              </svg>
            </button>
          )}
          <button onClick={() => onDelete()} title="Elimina (Canc)"
            style={actionChipStyle('#EF4444', '#fff')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        </div>}

        {/* Formatting toolbar: text gets font-size + text + fill colour; arrows get
            stroke-width + stroke colour; shapes get border + opacity + fill (no font
            size since shapes are now pure visual frames). Counter-rotated so its
            content stays upright when the sticker itself is rotated. */}
        {showHandles && (isText || isShape || isArrow) && (
          <div onMouseDown={(e) => e.stopPropagation()} style={{
            position: 'absolute', bottom: -56,
            left: isArrow ? Math.min((sticker.w < 0 ? 0 : cw), (sticker.w < 0 ? cw : 0)) : '50%',
            transform: `${isArrow ? '' : 'translateX(-50%) '}rotate(${-(sticker.rotation || 0)}deg)`.trim(),
            transformOrigin: 'center center',
            background: '#fff', borderRadius: 10, padding: '6px 10px', display: 'flex', gap: 10, alignItems: 'center',
            boxShadow: '0 4px 14px rgba(0,0,0,0.18)', border: '1px solid #E2E8F0', zIndex: 30,
            pointerEvents: 'auto',
          }}>
            {!isShape && <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => onUpdate({ font_size: Math.max(isArrow ? 1 : 10, (sticker.font_size || (isArrow ? 3 : 18)) - (isArrow ? 1 : 2)) })}
                  style={miniBtn}>{isArrow ? '−' : 'A−'}</button>
                <span style={{ fontSize: 11, color: '#64748B', minWidth: 18, textAlign: 'center' }}>
                  {sticker.font_size || (isArrow ? 3 : 18)}
                </span>
                <button onClick={() => onUpdate({ font_size: Math.min(isArrow ? 24 : 96, (sticker.font_size || (isArrow ? 3 : 18)) + (isArrow ? 1 : 2)) })}
                  style={miniBtn}>{isArrow ? '+' : 'A+'}</button>
              </div>
              <div style={{ width: 1, height: 18, background: '#E2E8F0' }} />
            </>}
            <div title={isArrow ? 'Colore freccia' : isShape ? 'Bordo' : 'Colore testo'} style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 14px)',
              gridAutoRows: '14px',
              gap: 3,
            }}>
              {TEXT_COLOR_SWATCHES.map(c => (
                <button key={c} onClick={() => onUpdate({ text_color: c })} style={{
                  width: 14, height: 14, borderRadius: '50%', padding: 0,
                  background: c, cursor: 'pointer',
                  border: (sticker.text_color || '#1a1a1a') === c ? '2px solid #F28C28' : '1px solid #CBD5E1',
                }} />
              ))}
            </div>
            {!isArrow && <>
              <div style={{ width: 1, height: 18, background: '#E2E8F0' }} />
              <div title={isShape ? 'Riempimento' : 'Sfondo'} style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(10, 14px)',
                gridAutoRows: '14px',
                gap: 3,
              }}>
                {TEXT_BG_SWATCHES.map(c => (
                  <button key={c} onClick={() => onUpdate({ bg_color: c })} style={{
                    width: 14, height: 14, borderRadius: 4, padding: 0,
                    background: c === 'transparent' ? 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 8px 8px' : c,
                    cursor: 'pointer',
                    border: (sticker.bg_color || 'transparent') === c ? '2px solid #F28C28' : '1px solid #CBD5E1',
                  }} />
                ))}
              </div>
            </>}
            {isShape && <>
              <div style={{ width: 1, height: 18, background: '#E2E8F0' }} />
              {/* Border thickness */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} title="Spessore bordo (px)">
                <button onClick={() => onUpdate({ border_width: Math.max(0, (sticker.border_width ?? 2) - 1) })} style={miniBtn}>−</button>
                <span style={{ fontSize: 11, color: '#64748B', minWidth: 14, textAlign: 'center' }}>
                  {sticker.border_width ?? 2}
                </span>
                <button onClick={() => onUpdate({ border_width: Math.min(20, (sticker.border_width ?? 2) + 1) })} style={miniBtn}>+</button>
              </div>
              <div style={{ width: 1, height: 18, background: '#E2E8F0' }} />
              {/* Opacity slider */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }} title="Opacità">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 3 a 9 9 0 0 0 0 18 Z" fill="#64748B" stroke="none" />
                </svg>
                <input type="range" min={0} max={100} step={5}
                  value={Math.round(((typeof sticker.opacity === 'number' ? sticker.opacity : 1)) * 100)}
                  onChange={(e) => onUpdate({ opacity: Number(e.target.value) / 100 })}
                  style={{ width: 84, accentColor: '#F28C28' }} />
                <span style={{ fontSize: 11, color: '#64748B', minWidth: 26, textAlign: 'right' }}>
                  {Math.round(((typeof sticker.opacity === 'number' ? sticker.opacity : 1)) * 100)}%
                </span>
              </label>
            </>}
          </div>
        )}
    </div>}
  </>)
}

const miniBtn = {
  border: '1px solid #E2E8F0', background: '#F8FAFC', borderRadius: 6,
  padding: '2px 6px', fontSize: 11, fontWeight: 700, color: '#475569', cursor: 'pointer',
}

// Force-download an image sticker. R2 is a different origin, so the anchor
// `download` attribute is ignored by the browser — we fetch the bytes and
// hand the browser a same-origin blob URL instead. Falls back to opening the
// image in a new tab if the fetch is blocked (e.g. offline / CORS).
async function downloadImage(url) {
  const nameFromUrl = () => {
    try { return decodeURIComponent(new URL(url).pathname.split('/').pop()) || 'immagine' }
    catch { return 'immagine' }
  }
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objUrl
    a.download = nameFromUrl()
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(objUrl), 1000)
  } catch {
    window.open(url, '_blank', 'noopener')
  }
}

const actionChipStyle = (bg, fg) => ({
  width: 26, height: 26, borderRadius: '50%',
  background: bg, border: '2px solid #fff', color: fg,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 2px 8px rgba(0,0,0,0.25)', padding: 0,
})

const zoomBtnStyle = {
  width: 36, height: 36, borderRadius: 8, border: '1px solid #D5DAE1',
  background: '#fff', color: '#475569', fontSize: 18, fontWeight: 600,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
}

const toolbarBtnStyle = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
  background: '#fff', color: '#1a1a1a', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', transition: 'all 0.12s ease',
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
  const [creativeMode, setCreativeMode] = useState(() => {
    const v = localStorage.getItem('storyboard_creative')
    if (v !== null) return v === 'true'
    return localStorage.getItem('storyboard_fun') === 'true' // legacy key
  })
  const [stickers, setStickers] = useState([])
  const [uploadingSticker, setUploadingSticker] = useState(false)
  const [activeTab, setActiveTab] = useState('shots')
  const [autoEditId, setAutoEditId] = useState(null)
  // Poppins is loaded async via @import (Google Fonts, display=swap). The first
  // paint may use the fallback font, which is narrower → measureDescH would compute
  // a too-small cellH and the description gets clipped by the row's overflow:hidden.
  // We bump `measureNonce` once fonts finish loading so CanvasBoard re-runs computeRowH
  // with the real font metrics.
  const [measureNonce, setMeasureNonce] = useState(0)
  useEffect(() => {
    if (typeof document === 'undefined' || !document.fonts) return
    let cancelled = false
    const bump = () => { if (!cancelled) setMeasureNonce(n => n + 1) }
    document.fonts.ready.then(bump)
    // Also bump on each font load event (in case more weights stream in later)
    const onLoadingDone = () => bump()
    document.fonts.addEventListener?.('loadingdone', onLoadingDone)
    return () => {
      cancelled = true
      document.fonts.removeEventListener?.('loadingdone', onLoadingDone)
    }
  }, [])

  const toggleCreative = () => {
    const next = !creativeMode
    setCreativeMode(next)
    localStorage.setItem('storyboard_creative', next)
  }

  const loadImages = useCallback(async () => {
    // Always release the loading state, otherwise a missing project or a
    // failed query (RLS, network) leaves the page on its spinner forever.
    if (!currentProject?.id) { setLoading(false); return }
    try {
      const data = await getStoryboardImages(currentProject.id)
      const shotIds = new Set((shots || []).map(s => s.id))
      const assetIds = new Set((assets || []).map(a => a.id))
      setWipImages((data || []).filter(img => (img.shot_id && shotIds.has(img.shot_id)) || (img.asset_id && assetIds.has(img.asset_id))))
    } catch (e) {
      console.warn('[storyboard] loadImages failed:', e?.message || e)
      setWipImages([])
    } finally {
      setLoading(false)
    }
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

  // Refs that follow the latest values without forcing callback re-creation.
  const stickersRef = useRef(stickers)
  stickersRef.current = stickers
  const creativeModeRef = useRef(creativeMode)
  creativeModeRef.current = creativeMode
  const activeTabRef = useRef(activeTab)
  activeTabRef.current = activeTab

  // Undo stack — declared as a ref BEFORE handleCreateSticker so the create-undo
  // bookkeeping below doesn't hit the temporal dead zone. `handleUndo` (which needs
  // currentProject / user) is defined further down once those are in scope.
  const undoStack = useRef([])
  const pushUndo = useCallback((entry) => {
    undoStack.current.push(entry)
    if (undoStack.current.length > 30) undoStack.current.shift()
  }, [])

  // Unified item creator — handles image files (upload to Cloudinary) and plain text.
  // Declared BEFORE the effects that depend on it to avoid TDZ during render.
  const handleCreateSticker = useCallback(async ({ kind, file, text, x, y, w, h, text_color, font_size, _optimistic }) => {
    if (!currentProject?.id || !creativeModeRef.current) return
    const baseX = Math.round(x ?? 300), baseY = Math.round(y ?? 300)
    const board = activeTabRef.current // 'shots' | 'assets'
    // z_index is computed per board so a new sticker stacks on top of the current
    // board's existing stickers (not all stickers across both boards).
    const z = stickersRef.current.filter(s => (s.board || 'shots') === board).length

    if (kind === 'image') {
      if (!file) return
      setUploadingSticker(true)
      const { url, width: natW, height: natH, error } = await uploadStickerImage(currentProject.id, file)
      setUploadingSticker(false)
      if (error) { addToast?.('Upload error: ' + error.message, 'danger'); return }
      // Fit the natural image dimensions into a sensible default box (longest side = 300px)
      // so the selection bounds match the image aspect ratio (no empty bars on portraits).
      let sw = w || 220, sh = h || 220
      if (natW && natH) {
        const MAX = 300
        const ratio = natW / natH
        if (natW >= natH) { sw = MAX; sh = Math.round(MAX / ratio) }
        else { sh = MAX; sw = Math.round(MAX * ratio) }
      }
      const { data } = await createSticker({
        project_id: currentProject.id, user_id: user.id, board,
        kind: 'image', image_url: url,
        x: baseX, y: baseY, w: sw, h: sh, rotation: 0, z_index: z,
      })
      if (data?.id) {
        setStickers(prev => prev.some(s => s.id === data.id) ? prev : [...prev, data])
        pushUndo({ type: 'create', id: data.id })
      }
      return
    }

    if (kind === 'text') {
      const { data } = await createSticker({
        project_id: currentProject.id, user_id: user.id, board,
        kind: 'text', text_content: text || '',
        text_color: '#1a1a1a', bg_color: '#FEF3C7', font_size: 18,
        x: baseX, y: baseY, w: w || 240, h: h || 80, rotation: 0, z_index: z,
      })
      if (data?.id) {
        setStickers(prev => prev.some(s => s.id === data.id) ? prev : [...prev, data])
        pushUndo({ type: 'create', id: data.id })
        setAutoEditId(data.id)
        setTimeout(() => setAutoEditId(curr => curr === data.id ? null : curr), 1500)
      }
      return
    }

    if (kind === 'rect' || kind === 'ellipse') {
      // Frames go BEHIND everything else in the current board by default — they're
      // typically used as section markers / background highlights. Soft opacity and
      // a thin 1px border keep them from competing with foreground content.
      const minZ = stickersRef.current
        .filter(s => (s.board || 'shots') === board)
        .reduce((m, s) => Math.min(m, s.z_index || 0), 0)
      const { data } = await createSticker({
        project_id: currentProject.id, user_id: user.id, board,
        kind, text_content: text || '',
        // Lightest greys from each palette by default — calm neutral frame that
        // doesn't compete with the content placed on top. text_color is slate-300
        // (the lightest non-white grey in the stroke swatches); bg_color is
        // slate-100 (the lightest non-transparent grey in the fill swatches).
        text_color: '#CBD5E1', bg_color: '#F1F5F9', font_size: 14,
        opacity: 0.5, border_width: 1,
        x: baseX, y: baseY, w: w || 200, h: h || 140, rotation: 0, z_index: minZ - 1,
      })
      if (data?.id) {
        setStickers(prev => prev.some(s => s.id === data.id) ? prev : [...prev, data])
        pushUndo({ type: 'create', id: data.id })
      }
      return
    }

    if (kind === 'arrow') {
      // Arrow keeps directional deltas (w/h may be negative). Don't clamp to defaults
      // unless we actually have nothing — otherwise we'd lose direction information.
      const ww = (typeof w === 'number') ? Math.round(w) : 120
      const hh = (typeof h === 'number') ? Math.round(h) : 0
      const { data } = await createSticker({
        project_id: currentProject.id, user_id: user.id, board,
        kind: 'arrow', text_content: null,
        text_color: '#1a1a1a', bg_color: null, font_size: 3,
        x: baseX, y: baseY, w: ww, h: hh, rotation: 0, z_index: z,
      })
      if (data?.id) {
        setStickers(prev => prev.some(s => s.id === data.id) ? prev : [...prev, data])
        pushUndo({ type: 'create', id: data.id })
      }
      return
    }

    if (kind === 'stroke') {
      // Pen stroke. Points come in `text` as a JSON payload (see parseStroke):
      // `{ w, h, segs: [[[x,y]...]] }`. text_color = stroke colour, font_size =
      // brush thickness in px. We persist via the existing sticker schema and the
      // realtime channel broadcasts new strokes to anyone else viewing the project.
      // (Migration 060 added 'stroke' to the kind CHECK constraint.)
      const payload = {
        project_id: currentProject.id, user_id: user.id, board,
        kind: 'stroke', text_content: text || '[]',
        text_color: text_color || '#1a1a1a', bg_color: null,
        font_size: typeof font_size === 'number' ? font_size : 4,
        x: baseX, y: baseY, w: w || 1, h: h || 1, rotation: 0, z_index: z,
      }
      // Optimistic render: drop a temp sticker into local state IMMEDIATELY so
      // the user sees no flicker between releasing the pen and the DB roundtrip
      // completing. When the real insert returns, swap the temp row for the
      // server row (preserves the id used by the realtime channel for de-dup).
      const tempId = `tmp_${Math.random().toString(36).slice(2, 10)}`
      if (_optimistic) {
        setStickers(prev => [...prev, { ...payload, id: tempId, created_at: new Date().toISOString() }])
      }
      const { data, error } = await createSticker(payload)
      if (error) {
        console.warn('[stroke create] failed:', error.message)
        addToast?.('Errore salvataggio tratto: ' + error.message, 'danger')
        if (_optimistic) setStickers(prev => prev.filter(s => s.id !== tempId))
        return
      }
      if (data?.id) {
        setStickers(prev => {
          // Replace the optimistic stub with the real row. If the realtime channel
          // already delivered the real one, also dedupe it.
          const withoutTemp = prev.filter(s => s.id !== tempId)
          if (withoutTemp.some(s => s.id === data.id)) return withoutTemp
          return [...withoutTemp, data]
        })
        pushUndo({ type: 'create', id: data.id })
      }
    }
  }, [currentProject?.id, user?.id, addToast, pushUndo])

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

  // Page focus refetch: if a tab has been idle (sleep, background), the Realtime
  // channel can miss DELETEs. A focus/visibility refetch keeps the local state honest.
  useEffect(() => {
    if (!currentProject?.id) return
    const onWake = () => {
      if (document.visibilityState === 'visible') { loadImages(); loadStickers() }
    }
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [currentProject?.id, loadImages, loadStickers])

  // Creative mode: window-level fallbacks so external drops/pastes always work,
  // even if the canvas didn't get the native event (Mac/Safari quirks, drop outside the surface).
  useEffect(() => {
    if (!creativeMode || !currentProject?.id) return

    const onWinDragOver = (e) => {
      // Prevent the browser from opening the dropped file as a new page.
      if (e.dataTransfer?.types?.length) e.preventDefault()
    }
    const onWinDrop = async (e) => {
      if (e.defaultPrevented) return // canvas already handled it
      const dt = e.dataTransfer
      if (!dt) return
      e.preventDefault()
      // Safari: dataTransfer.files can be empty when items has them — try both
      const files = []
      if (dt.files && dt.files.length) for (const f of dt.files) files.push(f)
      if (!files.length && dt.items && dt.items.length) {
        for (const it of dt.items) {
          if (it.kind === 'file') {
            const f = it.getAsFile()
            if (f) files.push(f)
          }
        }
      }
      if (files.length) {
        for (const f of files) {
          if (f.type.startsWith('image/')) {
            await handleCreateSticker({ kind: 'image', file: f, x: 300, y: 300 })
          }
        }
        return
      }
      const txt = dt.getData('text/plain')
      if (txt && txt.trim()) await handleCreateSticker({ kind: 'text', text: txt.trim(), x: 300, y: 300 })
    }
    const onPaste = async (e) => {
      const t = e.target
      if (t && (t.isContentEditable || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      const items = e.clipboardData?.items
      if (!items || !items.length) return
      for (const item of items) {
        if (item.type && item.type.startsWith('image/')) {
          const f = item.getAsFile()
          if (f) {
            e.preventDefault()
            await handleCreateSticker({ kind: 'image', file: f, x: 300, y: 300 })
            return
          }
        }
      }
      const txt = e.clipboardData?.getData('text/plain')
      if (txt && txt.trim()) {
        e.preventDefault()
        await handleCreateSticker({ kind: 'text', text: txt.trim(), x: 300, y: 300 })
      }
    }

    window.addEventListener('dragover', onWinDragOver)
    window.addEventListener('drop', onWinDrop)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragover', onWinDragOver)
      window.removeEventListener('drop', onWinDrop)
      window.removeEventListener('paste', onPaste)
    }
  }, [creativeMode, currentProject?.id, handleCreateSticker])

  // Pending updates keyed by sticker id, merged across rapid edits, flushed every 800ms
  // or eagerly on tab-hide / unload / unmount. Storing the merged payload (not just a
  // timer handle) lets us flush *the latest data* synchronously when the user navigates.
  const stickerSaveTimers = useRef({})
  const pendingStickerUpdates = useRef({})

  const flushStickerSave = useCallback((id) => {
    const upd = pendingStickerUpdates.current[id]
    if (!upd) return
    delete pendingStickerUpdates.current[id]
    if (stickerSaveTimers.current[id]) {
      clearTimeout(stickerSaveTimers.current[id])
      delete stickerSaveTimers.current[id]
    }
    updateSticker(id, upd)
      .then(() => busyStickerIds.current.delete(id))
      .catch(() => busyStickerIds.current.delete(id))
  }, [])

  const flushAllStickerSaves = useCallback(() => {
    for (const id in pendingStickerUpdates.current) flushStickerSave(id)
  }, [flushStickerSave])

  const handleStickerUpdate = useCallback((id, updates) => {
    busyStickerIds.current.add(id)
    setStickers(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
    // Merge with anything that hasn't been written yet so we never drop a change.
    pendingStickerUpdates.current[id] = { ...(pendingStickerUpdates.current[id] || {}), ...updates }
    if (stickerSaveTimers.current[id]) clearTimeout(stickerSaveTimers.current[id])
    stickerSaveTimers.current[id] = setTimeout(() => flushStickerSave(id), 800)
  }, [flushStickerSave])

  // Flush on tab hide / page unload / unmount so a route change or close
  // doesn't drop the last <800ms of edits.
  useEffect(() => {
    const onVisChange = () => { if (document.visibilityState === 'hidden') flushAllStickerSaves() }
    window.addEventListener('beforeunload', flushAllStickerSaves)
    window.addEventListener('pagehide', flushAllStickerSaves)
    document.addEventListener('visibilitychange', onVisChange)
    return () => {
      window.removeEventListener('beforeunload', flushAllStickerSaves)
      window.removeEventListener('pagehide', flushAllStickerSaves)
      document.removeEventListener('visibilitychange', onVisChange)
      flushAllStickerSaves() // also flush on StoryboardPage unmount (in-app navigation)
    }
  }, [flushAllStickerSaves])

  // Undo handler — pops the most recent recorded op and reverses it. The undoStack /
  // pushUndo themselves are hoisted above handleCreateSticker (TDZ safety).
  const handleUndo = useCallback(async () => {
    const entry = undoStack.current.pop()
    if (!entry) return
    const applyOne = async (e) => {
      if (e.type === 'delete') {
        const s = e.sticker
        const { data } = await createSticker({
          project_id: s.project_id || currentProject.id, user_id: user.id,
          board: s.board || 'shots', kind: s.kind, image_url: s.image_url,
          text_content: s.text_content, text_color: s.text_color, bg_color: s.bg_color,
          font_size: s.font_size, x: s.x, y: s.y, w: s.w, h: s.h,
          rotation: s.rotation || 0, z_index: s.z_index || 0,
        })
        if (data?.id) setStickers(prev => prev.some(st => st.id === data.id) ? prev : [...prev, data])
      } else if (e.type === 'create') {
        if (stickerSaveTimers.current[e.id]) { clearTimeout(stickerSaveTimers.current[e.id]); delete stickerSaveTimers.current[e.id] }
        delete pendingStickerUpdates.current[e.id]
        setStickers(prev => prev.filter(s => s.id !== e.id))
        await deleteSticker(e.id)
      } else if (e.type === 'update') {
        // Restore pre-gesture state via the regular optimistic path so the DB
        // save + realtime reconcile work as usual.
        handleStickerUpdate(e.id, e.before)
      }
    }
    if (entry.type === 'multi') {
      // Batched undo (currently used by the eraser): restore every sub-entry
      // recorded for the gesture so one Ctrl+Z reverts the whole drag.
      for (const sub of (entry.entries || [])) await applyOne(sub)
      return
    }
    await applyOne(entry)
  }, [currentProject?.id, user?.id, handleStickerUpdate])

  // Z-order: bring to front / send to back. Uses the existing optimistic update path
  // (handleStickerUpdate) so the new ordering is rendered immediately and saved with
  // the usual 800ms debounce / unmount flush.
  const handleBringForward = useCallback((id) => {
    const maxZ = stickersRef.current.reduce((m, s) => Math.max(m, s.z_index || 0), 0)
    handleStickerUpdate(id, { z_index: maxZ + 1 })
  }, [handleStickerUpdate])

  const handleSendBack = useCallback((id) => {
    const minZ = stickersRef.current.reduce((m, s) => Math.min(m, s.z_index || 0), 0)
    handleStickerUpdate(id, { z_index: minZ - 1 })
  }, [handleStickerUpdate])

  const handleStickerDelete = async (id, { skipUndo = false } = {}) => {
    // Cancel any pending update for this sticker (we're about to remove it).
    if (stickerSaveTimers.current[id]) { clearTimeout(stickerSaveTimers.current[id]); delete stickerSaveTimers.current[id] }
    delete pendingStickerUpdates.current[id]
    const target = stickersRef.current.find(s => s.id === id)
    // skipUndo is used by the eraser tool: it commits ONE batched undo entry
    // for the whole gesture, so it doesn't want each underlying stroke delete
    // to push its own redundant entry.
    if (target && !skipUndo) pushUndo({ type: 'delete', sticker: target })
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

  // Creative mode = whole storyboard, no filters allowed. Force everything to 'all'.
  const effFilterSeq = creativeMode ? 'all' : filterSeq
  const effFilterStatus = creativeMode ? 'all' : filterStatus
  const effSearch = creativeMode ? '' : searchText

  // Per-shot / per-asset task buckets. Used by both the status filter and the
  // per-item task-status bar list in the canvas.
  const tasksByShot = useMemo(() => {
    const m = {}
    for (const t of tasks || []) {
      if (!t.shot_id) continue
      ;(m[t.shot_id] = m[t.shot_id] || []).push(t)
    }
    return m
  }, [tasks])
  const tasksByAsset = useMemo(() => {
    const m = {}
    for (const t of tasks || []) {
      if (!t.asset_id) continue
      ;(m[t.asset_id] = m[t.asset_id] || []).push(t)
    }
    return m
  }, [tasks])

  // SHOT_STATUSES.id values are derived from the task list (not raw task statuses):
  // - in_progress: any task is wip OR review
  // - approved:    at least one task exists AND all tasks are approved
  // - not_started: no tasks OR every task is todo
  const matchesFilterStatus = useCallback((bucket, status) => {
    const ts = bucket || []
    if (status === 'in_progress') return ts.some(t => t.status === 'wip' || t.status === 'review')
    if (status === 'approved')    return ts.length > 0 && ts.every(t => t.status === 'approved')
    if (status === 'not_started') return ts.length === 0 || ts.every(t => t.status === 'todo')
    return true
  }, [])

  const filteredShots = useMemo(() => {
    let list = shots || []
    if (effFilterSeq !== 'all') list = list.filter(s => s.sequence === effFilterSeq)
    if (effSearch) { const q = effSearch.toLowerCase(); list = list.filter(s => s.code?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)) }
    if (effFilterStatus !== 'all') list = list.filter(s => matchesFilterStatus(tasksByShot[s.id], effFilterStatus))
    return list
  }, [shots, effFilterSeq, effSearch, effFilterStatus, tasksByShot, matchesFilterStatus])

  const filteredAssets = useMemo(() => {
    let list = assets || []
    if (effSearch) { const q = effSearch.toLowerCase(); list = list.filter(a => a.name?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)) }
    if (effFilterStatus !== 'all') list = list.filter(a => matchesFilterStatus(tasksByAsset[a.id], effFilterStatus))
    return list
  }, [assets, effSearch, effFilterStatus, tasksByAsset, matchesFilterStatus])

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
            {/* Clean / Creative mode toggle */}
            <div role="tablist" aria-label="Storyboard mode" style={{
              display: 'inline-flex', background: '#F1F5F9', borderRadius: 999, padding: 3, gap: 2,
              border: creativeMode ? '1px solid #FCD34D' : '1px solid transparent',
              transition: 'border-color 0.15s',
            }}>
              {[
                { id: 'clean', label: 'Clean' },
                { id: 'creative', label: 'Creative' },
              ].map(opt => {
                const active = (opt.id === 'creative') === creativeMode
                return (
                  <button key={opt.id} onClick={() => { const wantCreative = opt.id === 'creative'; if (wantCreative !== creativeMode) toggleCreative() }} style={{
                    padding: '5px 14px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600,
                    background: active ? '#fff' : 'transparent',
                    color: active ? (opt.id === 'creative' ? '#D97706' : ACCENT) : '#64748B',
                    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s',
                  }}>{opt.label}</button>
                )
              })}
            </div>
            {creativeMode && uploadingSticker && (
              <span style={{ fontSize: 11, color: '#D97706', fontWeight: 600 }}>Caricamento...</span>
            )}
            {!creativeMode && (
              <div style={{ position: 'relative', minWidth: isMobile ? 120 : 180 }}>
                <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}><IconSearch size={14} color="#94A3B8" /></div>
                <input value={searchText} onChange={e => setSearchText(e.target.value)} placeholder={isShotsTab ? 'Cerca shot...' : 'Cerca asset...'}
                  style={{ width: '100%', padding: '6px 10px 6px 30px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, background: '#F8FAFC', outline: 'none' }} />
              </div>
            )}
          </div>
        </div>

        {!creativeMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            {isShotsTab && (<>
              <FilterPill label="Tutti" active={filterSeq === 'all'} onClick={() => setFilterSeq('all')} />
              {allSequences.map(seq => <FilterPill key={seq} label={seq} active={filterSeq === seq} onClick={() => setFilterSeq(seq)} />)}
              <div style={{ width: 1, height: 18, background: '#E2E8F0', margin: '0 4px' }} />
            </>)}
            {SHOT_STATUSES.map(st => <FilterPill key={st.id} label={st.label} active={filterStatus === st.id} onClick={() => setFilterStatus(filterStatus === st.id ? 'all' : st.id)} dotColor={st.color} />)}
          </div>
        )}
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
          getTasks={(s) => tasksByShot[s.id] || []}
          openCellImage={openShotCellImage} openRef={openShotRef}
          creativeMode={creativeMode}
          stickers={stickers.filter(s => (s.board || 'shots') === 'shots')}
          autoEditId={autoEditId}
          onStickerUpdate={handleStickerUpdate} onStickerDelete={handleStickerDelete}
          onBringForward={handleBringForward} onSendBack={handleSendBack}
          onUndo={handleUndo} onCommitUndo={pushUndo}
          onCreateSticker={handleCreateSticker} />
      ) : (
        <CanvasBoard
          sequences={assetSequences} imageMap={assetImageMap} depts={ASSET_DEPTS}
          getCode={a => a.name}
          getRefUrl={a => a.ref_cloud_url}
          getDescription={a => a.description}
          getDeptStatus={(a, dId) => a[STATUS_KEY(dId)]}
          getTasks={(a) => tasksByAsset[a.id] || []}
          openCellImage={openAssetCellImage} openRef={openAssetRef}
          creativeMode={creativeMode}
          stickers={stickers.filter(s => (s.board || 'shots') === 'assets')}
          autoEditId={autoEditId}
          onStickerUpdate={handleStickerUpdate} onStickerDelete={handleStickerDelete}
          onBringForward={handleBringForward} onSendBack={handleSendBack}
          onUndo={handleUndo} onCommitUndo={pushUndo}
          onCreateSticker={handleCreateSticker} />
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
