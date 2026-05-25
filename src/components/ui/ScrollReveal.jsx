import { useEffect, useMemo, useRef, useState } from 'react'

// Scroll-driven, per-word reveal effect inspired by lightswind.com/components/scroll-reveal.
// Pure CSS + IntersectionObserver — no framer-motion dependency.
//
// Each word starts faded/blurred/translated and animates to its resting state
// once its parent scrolls into view. A small per-word stagger creates the
// "wave" feel, and a subtle scroll-linked container rotation mimics the original.
export default function ScrollReveal({
  children,
  baseOpacity = 0.12,
  baseRotation = 3,
  blurStrength = 4,
  enableBlur = true,
  staggerDelay = 0.05,   // seconds between consecutive words
  threshold = 0.35,      // viewport ratio that triggers reveal
  duration = 0.7,        // seconds per word
  fontSize = 22,         // px — restful, readable script body
  lineHeight = 1.65,
  color = '#1a1a1a',
  style,
}) {
  const text = typeof children === 'string' ? children : ''
  const containerRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [rot, setRot] = useState(baseRotation)

  // Split into words while preserving paragraph breaks.
  const paragraphs = useMemo(() => {
    return text.split(/\n{2,}/).map(p => p.split(/(\s+)/).filter(s => s.length > 0))
  }, [text])

  // Reveal trigger — reuses a single observer for the wrapper.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.intersectionRatio >= threshold) setVisible(true)
          else if (e.intersectionRatio === 0) setVisible(false)
        }
      },
      { threshold: [0, threshold, 1] }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])

  // Scroll-linked container rotation — eases from baseRotation → 0 as the
  // element moves through the viewport. Cheap rAF throttle, listener is passive.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const r = el.getBoundingClientRect()
        const vh = window.innerHeight || 1
        // progress: 0 when bottom of element hits bottom of viewport,
        //           1 when top of element hits top of viewport.
        const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)))
        // Same shape as the original (rotation only on the first half).
        const eased = p < 0.5 ? baseRotation * (1 - p * 2) : 0
        setRot(eased)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [baseRotation])

  // Sequential index across paragraphs so the stagger keeps flowing.
  let wordIdx = -1

  return (
    <div
      ref={containerRef}
      style={{
        transform: `rotate(${rot}deg)`,
        transformOrigin: 'center top',
        transition: 'transform 120ms linear',
        willChange: 'transform',
        ...style,
      }}
    >
      {paragraphs.map((parts, pi) => (
        <p
          key={pi}
          style={{
            margin: '0 0 1.1em',
            fontSize,
            lineHeight,
            color,
            fontWeight: 500,
          }}
        >
          {parts.map((part, i) => {
            const isSpace = /^\s+$/.test(part)
            if (isSpace) return <span key={i}>{part}</span>
            wordIdx++
            const delay = (wordIdx * staggerDelay).toFixed(3)
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  opacity: visible ? 1 : baseOpacity,
                  filter: enableBlur ? (visible ? 'blur(0px)' : `blur(${blurStrength}px)`) : 'none',
                  transform: visible ? 'translateY(0)' : 'translateY(14px)',
                  transition: `opacity ${duration}s ease, filter ${duration}s ease, transform ${duration}s cubic-bezier(0.22, 1, 0.36, 1)`,
                  transitionDelay: `${delay}s`,
                  willChange: 'opacity, filter, transform',
                }}
              >
                {part}
              </span>
            )
          })}
        </p>
      ))}
    </div>
  )
}
