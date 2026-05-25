import { useEffect, useMemo, useRef, useState } from 'react'

// Lightweight script viewer. Per-word reveals with blur filters tank
// performance on multi-page screenplays (thousands of GPU layers + blur
// repaint each frame). We render each paragraph as plain text and do a single
// short fade per paragraph on enter — cheap and responsive.
export default function ScrollReveal({
  children,
  fontSize = 22,
  lineHeight = 1.65,
  color = '#1a1a1a',
  style,
}) {
  const text = typeof children === 'string' ? children : ''
  const paragraphs = useMemo(() => text.split(/\n{2,}/).filter(p => p.trim()), [text])

  return (
    <div style={style}>
      {paragraphs.map((p, i) => (
        <FadeParagraph
          key={i}
          text={p}
          fontSize={fontSize}
          lineHeight={lineHeight}
          color={color}
        />
      ))}
    </div>
  )
}

function FadeParagraph({ text, fontSize, lineHeight, color }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
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

  return (
    <p
      ref={ref}
      style={{
        margin: '0 0 1.1em',
        fontSize,
        lineHeight,
        color,
        fontWeight: 500,
        whiteSpace: 'pre-wrap',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 180ms ease, transform 180ms ease',
      }}
    >
      {text}
    </p>
  )
}
