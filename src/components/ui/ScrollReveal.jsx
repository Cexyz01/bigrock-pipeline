import { useEffect, useMemo, useRef, useState } from 'react'

// Scroll-driven, per-word reveal — port of lightswind.com/components/scroll-reveal
// in plain React + CSS (no framer-motion dep).
//
// Each PARAGRAPH owns its own IntersectionObserver. This matters: the original
// uses framer's `useInView` with a viewport-amount threshold, which works fine
// for short hero text but stalls on multi-page screenplays where the wrapper is
// many times taller than the viewport. Observing per paragraph keeps the wave
// effect feeling tied to scroll position no matter how long the script is.
export default function ScrollReveal({
  children,
  baseOpacity = 0.1,
  baseRotation = 3,
  blurStrength = 4,
  enableBlur = true,
  staggerDelay = 0.05,
  duration = 0.8,
  fontSize = 22,
  lineHeight = 1.65,
  color = '#1a1a1a',
  style,
}) {
  const text = typeof children === 'string' ? children : ''
  const wrapperRef = useRef(null)
  const [rot, setRot] = useState(baseRotation)

  const paragraphs = useMemo(() => {
    return text.split(/\n{2,}/).map(p => p.split(/(\s+)/).filter(s => s.length > 0))
  }, [text])

  // Scroll-linked wrapper rotation — matches the original's `useTransform` over
  // [start end, end start] mapped to [baseRotation, 0, 0].
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    let raf = 0
    const tick = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight || 1
      // progress 0 → wrapper bottom at viewport bottom (start end)
      // progress 1 → wrapper top    at viewport top    (end start)
      const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)))
      const eased = p < 0.5 ? baseRotation * (1 - p * 2) : 0
      setRot(eased)
    }
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick) }
    tick()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [baseRotation])

  return (
    <div
      ref={wrapperRef}
      style={{
        transform: `rotate(${rot}deg)`,
        transformOrigin: 'center top',
        transition: 'transform 120ms linear',
        willChange: 'transform',
        ...style,
      }}
    >
      {paragraphs.map((parts, pi) => (
        <RevealParagraph
          key={pi}
          parts={parts}
          baseOpacity={baseOpacity}
          blurStrength={blurStrength}
          enableBlur={enableBlur}
          staggerDelay={staggerDelay}
          duration={duration}
          fontSize={fontSize}
          lineHeight={lineHeight}
          color={color}
        />
      ))}
    </div>
  )
}

function RevealParagraph({
  parts, baseOpacity, blurStrength, enableBlur,
  staggerDelay, duration, fontSize, lineHeight, color,
}) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Trigger slightly before the paragraph fully enters view so the wave
    // feels anticipatory rather than catch-up.
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true)
            io.disconnect()
            break
          }
        }
      },
      { rootMargin: '0px 0px -15% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Spring-like ease (overshoot 1.05 → settle). Close enough to framer's
  // { damping: 25, stiffness: 100 } without pulling in the library.
  const spring = 'cubic-bezier(0.22, 1.2, 0.36, 1)'

  let wordIdx = -1
  return (
    <p
      ref={ref}
      style={{
        margin: '0 0 1.1em',
        fontSize,
        lineHeight,
        color,
        fontWeight: 600,
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
              transform: visible ? 'translateY(0)' : 'translateY(20px)',
              transition: `opacity ${duration}s ease, filter ${duration}s ease, transform ${duration}s ${spring}`,
              transitionDelay: visible ? `${delay}s` : '0s',
              willChange: 'opacity, filter, transform',
            }}
          >
            {part}
          </span>
        )
      })}
    </p>
  )
}
