import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import Img from './Img'
import { useImageAnnotation } from '../../hooks/useImageAnnotations'

// <img>-like component that overlays saved teacher annotations on top of the
// image at the correct scale/aspect. Strokes are stored in normalised [0..1]
// of the image's natural size, so they replay correctly at any display rect.
//
// The wrapper computes the actual image rect inside its box (cover vs contain)
// and positions the SVG to match — strokes stay glued to the pixels of the
// image rather than the container, which matters for thumbnails.

function computeImageRect(natW, natH, cW, cH, fit) {
  if (!natW || !natH || !cW || !cH) return { x: 0, y: 0, w: cW || 0, h: cH || 0 }
  const imgAR = natW / natH
  const ctnAR = cW / cH
  if (fit === 'cover') {
    if (imgAR > ctnAR) { const h = cH, w = h * imgAR; return { x: (cW - w) / 2, y: 0, w, h } }
    const w = cW, h = w / imgAR; return { x: 0, y: (cH - h) / 2, w, h }
  }
  if (fit === 'fill') return { x: 0, y: 0, w: cW, h: cH }
  // 'contain' (default)
  if (imgAR > ctnAR) { const w = cW, h = w / imgAR; return { x: 0, y: (cH - h) / 2, w, h } }
  const h = cH, w = h * imgAR; return { x: (cW - w) / 2, y: 0, w, h }
}

export function AnnotationOverlay({ strokes, rect }) {
  if (!strokes || strokes.length === 0) return null
  if (!rect || !rect.w || !rect.h) return null
  return (
    <svg
      viewBox="0 0 1 1"
      preserveAspectRatio="none"
      style={{
        position: 'absolute',
        left: rect.x, top: rect.y, width: rect.w, height: rect.h,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {strokes.map((s, i) => {
        if (!s.points || s.points.length === 0) return null
        const d = s.points.map((p, idx) => `${idx === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`).join(' ')
        // Stroke width is stored as fraction of image width. We undo the
        // viewBox-induced non-uniform scaling by using vectorEffect, then set
        // strokeWidth as a fraction of rect.w (matches stored size semantics).
        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={s.color || '#ef4444'}
            strokeWidth={(s.size || 0.005) * rect.w}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ strokeWidth: `${(s.size || 0.005) * rect.w}px` }}
          />
        )
      })}
    </svg>
  )
}

export default function AnnotatedImage({
  src, w, h, fit, alt = '', style, onClick, wrapperStyle, ...rest
}) {
  const { strokes } = useImageAnnotation(src)
  const wrapRef = useRef(null)
  const imgWrapRef = useRef(null)
  const [natural, setNatural] = useState({ w: 0, h: 0 })
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 })

  const objectFit = (style && style.objectFit) || 'contain'

  // Measure the container so we can compute the visible image rect.
  useLayoutEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    const update = () => {
      const r = el.getBoundingClientRect()
      setContainerSize(prev => (prev.w === r.width && prev.h === r.height) ? prev : { w: r.width, h: r.height })
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const handleLoad = useCallback((e) => {
    const im = e.currentTarget
    if (im && im.naturalWidth) {
      setNatural({ w: im.naturalWidth, h: im.naturalHeight })
    }
  }, [])

  const rect = computeImageRect(natural.w, natural.h, containerSize.w, containerSize.h, objectFit)

  return (
    <div
      ref={wrapRef}
      onClick={onClick}
      style={{
        position: 'relative',
        display: 'block',
        overflow: 'hidden',
        ...style,
        ...wrapperStyle,
        // Caller's intended size lives in `style` (width/height/maxHeight etc.).
        // We forward it on the wrapper; the inner Img fills 100%.
        cursor: onClick ? (style?.cursor || 'zoom-in') : style?.cursor,
      }}
    >
      <Img
        src={src} w={w} h={h} fit={fit} alt={alt}
        onLoad={handleLoad}
        style={{
          width: '100%', height: '100%',
          objectFit, display: 'block',
          background: style?.background,
        }}
        {...rest}
      />
      <AnnotationOverlay strokes={strokes} rect={rect} />
    </div>
  )
}
