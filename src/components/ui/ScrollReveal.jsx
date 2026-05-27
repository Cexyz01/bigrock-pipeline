import { useEffect, useMemo, useRef, useState } from 'react'

// Lightweight script viewer. Per-word reveals with blur filters tank
// performance on multi-page screenplays (thousands of GPU layers + blur
// repaint each frame). We render each paragraph as plain text and do a single
// short fade per paragraph on enter — cheap and responsive.
//
// When `parseScript` is on we add three typographic affordances on top of the
// plain paragraph render:
//   1. First paragraph → document title (h1, centered, big).
//   2. Contiguous "Name - description" lines appearing before the first SHOT
//      get grouped under a synthetic "Personaggi" heading, with each name in
//      bold and the description after.
//   3. Paragraphs starting with "SHOT NN" → centered uppercase heading
//      ("SHOT NN" only) + description below.
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

  const blocks = useMemo(() => buildBlocks(paragraphs), [paragraphs])

  return (
    <div style={style}>
      {blocks.map((b, i) => {
        if (b.kind === 'title') {
          return (
            <FadeBlock key={i}>
              <h1 style={{
                margin: '0 0 1.2em', textAlign: 'center', color,
                fontSize: Math.round(fontSize * 2), lineHeight: 1.15,
                fontWeight: 800, letterSpacing: '0.02em',
              }}>{b.text}</h1>
            </FadeBlock>
          )
        }
        if (b.kind === 'characters') {
          return (
            <FadeBlock key={i}>
              <div style={{ margin: '1.4em 0 1.6em' }}>
                <h2 style={{
                  margin: '0 0 0.7em', textAlign: 'center', color,
                  fontSize: Math.round(fontSize * 1.15), lineHeight: 1.25,
                  fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>Personaggi</h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {b.items.map((it, j) => (
                    <li key={j} style={{
                      fontSize, lineHeight, color, fontWeight: 500,
                      margin: '0 0 0.5em',
                    }}>
                      <strong style={{ fontWeight: 800 }}>{it.name}</strong> — {it.desc}
                    </li>
                  ))}
                </ul>
              </div>
            </FadeBlock>
          )
        }
        if (b.kind === 'shot') {
          return (
            <FadeBlock key={i}>
              <div style={{ margin: '1.6em 0 1.2em' }}>
                <h2 style={{
                  margin: '0 0 0.5em', textAlign: 'center', color,
                  fontSize: Math.round(fontSize * 1.15), lineHeight: 1.25,
                  fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>{b.title}</h2>
                {b.description && (
                  <p style={{
                    margin: 0, fontSize, lineHeight, color, fontWeight: 500,
                    whiteSpace: 'pre-wrap', textAlign: 'left',
                  }}>{b.description}</p>
                )}
              </div>
            </FadeBlock>
          )
        }
        return (
          <FadeParagraph key={i} text={b.text} fontSize={fontSize} lineHeight={lineHeight} color={color} />
        )
      })}
    </div>
  )
}

const SHOT_RE = /^(SHOT\s*\d+)\b/i
// A character line is a short name (1-4 words, letters only) followed by a
// dash (-, –, or —) and a description on a single line. Excludes anything
// with digits or punctuation in the name part so SHOT lines / sentences with
// stray dashes don't get swallowed.
const CHAR_RE = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’]*(?:\s+[A-Za-zÀ-ÿ'’]+){0,3})\s+[-–—]\s+(.+)$/

function isCharacterLine(text) {
  if (!text || text.includes('\n')) return null
  if (SHOT_RE.test(text)) return null
  const m = CHAR_RE.exec(text)
  if (!m) return null
  return { name: m[1].trim(), desc: m[2].trim() }
}

function parseShot(text) {
  const m = SHOT_RE.exec(text)
  if (!m) return null
  const prefix = m[0]
  return { title: prefix.trim(), description: text.slice(prefix.length).trim() }
}

function buildBlocks(paragraphs) {
  const blocks = []
  if (paragraphs.length === 0) return blocks
  blocks.push({ kind: 'title', text: paragraphs[0] })

  let i = 1
  // Greedy character block: consume contiguous character lines that appear
  // before the first SHOT. Stop as soon as we hit a non-character paragraph
  // (which might be a SHOT or just prose) so we don't accidentally fold
  // dashed sentences mid-script into the cast list.
  const items = []
  while (i < paragraphs.length) {
    const c = isCharacterLine(paragraphs[i])
    if (!c) break
    items.push(c)
    i++
  }
  if (items.length > 0) blocks.push({ kind: 'characters', items })

  for (; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    const shot = parseShot(p)
    if (shot) blocks.push({ kind: 'shot', ...shot })
    else blocks.push({ kind: 'paragraph', text: p })
  }
  return blocks
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
