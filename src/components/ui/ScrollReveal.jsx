import { useEffect, useMemo, useRef, useState } from 'react'

// Lightweight script viewer. Per-word reveals with blur filters tank
// performance on multi-page screenplays (thousands of GPU layers + blur
// repaint each frame). We render each paragraph as plain text and do a single
// short fade per paragraph on enter — cheap and responsive.
//
// When `parseScript` is on, the first paragraph becomes the document title and
// any paragraph starting with `SHOT NN` is rendered as a centered shot heading
// + a description below. Split rule: if the paragraph contains ` - `, the part
// before the first dash is the heading (so `SHOT 07 POV di Billy - inizia…`
// keeps the "POV di Billy" half in the heading); otherwise only the `SHOT NN`
// prefix is the heading and everything after goes to the description.
export default function ScrollReveal({
  children,
  fontSize = 22,
  lineHeight = 1.65,
  color = '#1a1a1a',
  parseScript = false,
  style,
}) {
  const text = typeof children === 'string' ? children : ''
  const paragraphs = useMemo(() => text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean), [text])

  if (!parseScript) {
    return (
      <div style={style}>
        {paragraphs.map((p, i) => (
          <FadeParagraph key={i} text={p} fontSize={fontSize} lineHeight={lineHeight} color={color} />
        ))}
      </div>
    )
  }

  const [titlePara, ...rest] = paragraphs
  return (
    <div style={style}>
      {titlePara && (
        <FadeBlock>
          <h1 style={{
            margin: '0 0 1.2em', textAlign: 'center', color,
            fontSize: Math.round(fontSize * 2), lineHeight: 1.15,
            fontWeight: 800, letterSpacing: '0.02em',
          }}>{titlePara}</h1>
        </FadeBlock>
      )}
      {rest.map((p, i) => {
        const shot = parseShotParagraph(p)
        if (shot) {
          return (
            <FadeBlock key={i}>
              <div style={{ margin: '1.6em 0 1.2em' }}>
                <h2 style={{
                  margin: '0 0 0.5em', textAlign: 'center', color,
                  fontSize: Math.round(fontSize * 1.15), lineHeight: 1.25,
                  fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>{shot.title}</h2>
                {shot.description && (
                  <p style={{
                    margin: 0, fontSize, lineHeight, color, fontWeight: 500,
                    whiteSpace: 'pre-wrap', textAlign: 'left',
                  }}>{shot.description}</p>
                )}
              </div>
            </FadeBlock>
          )
        }
        return (
          <FadeParagraph key={i} text={p} fontSize={fontSize} lineHeight={lineHeight} color={color} />
        )
      })}
    </div>
  )
}

const SHOT_RE = /^(SHOT\s*\d+)\b/i

function parseShotParagraph(text) {
  const m = SHOT_RE.exec(text)
  if (!m) return null
  const dashIdx = text.indexOf(' - ')
  if (dashIdx > 0) {
    return { title: text.slice(0, dashIdx).trim(), description: text.slice(dashIdx + 3).trim() }
  }
  const prefix = m[0]
  return { title: prefix.trim(), description: text.slice(prefix.length).trim() }
}

function useReveal() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      entries => { for (const e of entries) if (e.isIntersecting) { setVisible(true); io.disconnect(); break } },
      { rootMargin: '0px 0px -10% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, visible }
}

function FadeParagraph({ text, fontSize, lineHeight, color }) {
  const { ref, visible } = useReveal()
  return (
    <p
      ref={ref}
      style={{
        margin: '0 0 1.1em', fontSize, lineHeight, color, fontWeight: 500,
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

function FadeBlock({ children }) {
  const { ref, visible } = useReveal()
  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 180ms ease, transform 180ms ease',
      }}
    >
      {children}
    </div>
  )
}
