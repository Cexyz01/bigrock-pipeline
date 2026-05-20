import { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import Img from './Img'
import { AnnotationOverlay } from './AnnotatedImage'
import { useImageAnnotation } from '../../hooks/useImageAnnotations'
import ImageAnnotator from './ImageAnnotator'
import { isStaff } from '../../lib/constants'

// Image viewer. For staff this is the annotator (pen + eraser, auto-save).
// For students it's a readonly viewer that still renders saved annotations on
// top of the image so they can see teacher corrections.

export default function ImageLightbox({ src, onClose, user, addToast }) {
  // Staff jump straight into the annotator — drawing is the primary action,
  // no two-step "view then click Annota" UX. Students never enter the editor.
  const canAnnotate = isStaff(user)
  const { strokes } = useImageAnnotation(src)
  const wrapRef = useRef(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!src) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [src, onClose])

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

  // Staff: open the annotator directly. Drawing is immediate, save is automatic.
  if (canAnnotate) {
    return <ImageAnnotator src={src} onClose={onClose} addToast={addToast} />
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
