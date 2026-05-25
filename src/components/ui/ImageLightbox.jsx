import { useEffect, useState, useRef, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Img from './Img'
import { AnnotationOverlay } from './AnnotatedImage'
import { useImageAnnotation } from '../../hooks/useImageAnnotations'
import ImageAnnotator from './ImageAnnotator'
import { isStaff } from '../../lib/constants'
import { IconChevronLeft, IconChevronRight } from './Icons'

// Image viewer. For staff this is the annotator (pen + eraser, auto-save).
// For students it's a readonly viewer that still renders saved annotations on
// top of the image so they can see teacher corrections.

export default function ImageLightbox({ src, images, onClose, user, addToast }) {
  // Build the carousel list. Single-src callers keep working — images defaults
  // to [src]. Multi-image callers pass `images` + the `src` they clicked on.
  const list = useMemo(() => (Array.isArray(images) && images.length ? images : (src ? [src] : [])), [images, src])
  const initialIdx = useMemo(() => {
    if (!src) return 0
    const i = list.indexOf(src)
    return i >= 0 ? i : 0
  }, [list, src])

  const [idx, setIdx] = useState(initialIdx)
  // If the parent swaps the clicked image (e.g. opening a different WIP), reset
  useEffect(() => { setIdx(initialIdx) }, [initialIdx])

  const current = list[idx]
  const canNavigate = list.length > 1
  const prev = () => setIdx(i => (i - 1 + list.length) % list.length)
  const next = () => setIdx(i => (i + 1) % list.length)

  const canAnnotate = isStaff(user)
  const { strokes } = useImageAnnotation(current)
  const wrapRef = useRef(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!current) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      else if (canNavigate && e.key === 'ArrowLeft')  { e.preventDefault(); prev() }
      else if (canNavigate && e.key === 'ArrowRight') { e.preventDefault(); next() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, onClose, canNavigate])

  useLayoutEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    const update = () => {
      const r = el.getBoundingClientRect()
      setBox(prev => (prev.w === r.width && prev.h === r.height) ? prev : { w: r.width, h: r.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [current])

  if (!current) return null

  // Staff: open the annotator directly. `key` forces a clean remount on
  // navigation so the previous image's annotations flush-save on unmount.
  if (canAnnotate) {
    return (
      <ImageAnnotator
        key={current}
        src={current}
        onClose={onClose}
        addToast={addToast}
        onPrev={canNavigate ? prev : undefined}
        onNext={canNavigate ? next : undefined}
        index={canNavigate ? idx : undefined}
        total={canNavigate ? list.length : undefined}
      />
    )
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'zoom-out',
      }}
    >
      {canNavigate && <NavBtn side="left" onClick={(e) => { e.stopPropagation(); prev() }} />}
      <div
        ref={wrapRef}
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', display: 'inline-block', cursor: 'default', lineHeight: 0 }}
      >
        <Img
          key={current}
          src={current} w={1920} h={1920} fit="limit" alt=""
          onLoad={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            setBox({ w: r.width, h: r.height })
          }}
          style={{
            display: 'block',
            maxWidth: '92vw', maxHeight: '92vh',
            borderRadius: 8,
            boxShadow: '0 8px 60px rgba(0,0,0,0.5)',
          }}
        />
        <AnnotationOverlay strokes={strokes} rect={{ x: 0, y: 0, w: box.w, h: box.h }} />
      </div>
      {canNavigate && <NavBtn side="right" onClick={(e) => { e.stopPropagation(); next() }} />}
      {canNavigate && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          padding: '6px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600,
          letterSpacing: 0.4, pointerEvents: 'none',
        }}>
          {idx + 1} / {list.length}
        </div>
      )}
    </div>,
    document.body,
  )
}

function NavBtn({ side, onClick }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: 'absolute', top: '50%', transform: 'translateY(-50%)',
        [side]: 20,
        width: 48, height: 48, borderRadius: '50%',
        background: h ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(255,255,255,0.2)',
        color: '#fff', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s ease',
      }}
    >
      {side === 'left' ? <IconChevronLeft size={22} /> : <IconChevronRight size={22} />}
    </button>
  )
}
