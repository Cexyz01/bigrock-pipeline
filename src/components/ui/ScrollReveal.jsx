import { useEffect, useMemo, useRef, useState } from 'react'

// Scroll-driven, per-word reveal effect inspired by lightswind.com/components/scroll-reveal.
// Pure CSS + IntersectionObserver — no framer-motion dependency.
//
// Each paragraph observes its OWN visibility. When it enters the viewport the
// words inside wave in with a small per-word stagger. Per-paragraph observation
// is essential: for a long script the wrapper is taller than the viewport, so a
// single observer on the wrapper would never reach a meaningful ratio threshold
// and the words would stay blurred forever.
export default function ScrollReveal({
  children,
  baseOpacity = 0.12,
  blurStrength = 4,
  enableBlur = true,
  staggerDelay = 0.04,
  duration = 0.7,
  fontSize = 22,
  lineHeight = 1.65,
  color = '#1a1a1a',
  style,
}) {
  const text = typeof children === 'string' ? children : ''

  const paragraphs = useMemo(() => {
    return text.split(/\n{2,}/).map(p => p.split(/(\s+)/).filter(s => s.length > 0))
  }, [text])

  return (
    <div style={style}>
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
    // Reveal a bit before the paragraph fully enters view — feels more natural
    // than waiting for the top edge to cross the viewport bottom.
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
      { rootMargin: '0px 0px -10% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  let wordIdx = -1
  return (
    <p
      ref={ref}
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
