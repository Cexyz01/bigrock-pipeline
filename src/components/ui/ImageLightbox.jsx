import { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import Img from './Img'
import { AnnotationOverlay } from './AnnotatedImage'
import { useImageAnnotation } from '../../hooks/useImageAnnotations'
import ImageAnnotator from './ImageAnnotator'
import { isStaff } from '../../lib/constants'

// Lightbox that always renders any saved teacher annotations on top of the
// image. Staff get an "Annota" button to switch into the pen/eraser editor;
// students see only the readonly composite.

export default function ImageLightbox({ src, onClose, user, addToast }) {
  const [editing, setEditing] = useState(false)
  const { strokes } = useImageAnnotation(src)
  const wrapRef = useRef(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!src) return
    const onKey = (e) => { if (e.key === 'Escape' && !editing) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [src, onClose, editing])

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
  }, [src])

  if (!src) return null

  if (editing) {
    return <ImageAnnotator src={src} onClose={() => setEditing(false)} addToast={addToast} />
  }

  const canAnnotate = isStaff(user)

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
      {canAnnotate && (
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true) }}
          style={{
            position: 'absolute', top: 20, right: 20, zIndex: 1,
            padding: '10px 16px', borderRadius: 10,
            background: '#F28C28', color: '#fff', border: 'none',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >✏️ Annota</button>
      )}
      <div
        ref={wrapRef}
        onClick={(e) => e.stopPropagation()}
        style={{ position: 'relative', display: 'inline-block', cursor: 'default', lineHeight: 0 }}
      >
        <Img
          src={src} w={1920} h={1920} fit="limit" alt=""
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
    </div>,
    document.body,
  )
}
