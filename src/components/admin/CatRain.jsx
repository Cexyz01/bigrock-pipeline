import { useMemo, useEffect } from 'react'

// Only the two cats the user wants: orange tabby + black cat
const CATS = ['🐈', '🐈‍⬛']

const COUNT = 28

// Inject keyframes once
function injectKeyframes() {
  if (document.getElementById('cat-rain-kf')) return
  const style = document.createElement('style')
  style.id = 'cat-rain-kf'
  style.textContent = `
    @keyframes catRainFall {
      0%   { transform: translate3d(0, -10vh, 0) rotate(var(--r0)); }
      100% { transform: translate3d(var(--dx), 110vh, 0) rotate(var(--r1)); }
    }
  `
  document.head.appendChild(style)
}

export default function CatRain() {
  useEffect(() => { injectKeyframes() }, [])

  const cats = useMemo(() => Array.from({ length: COUNT }, (_, i) => {
    const size = 22 + Math.floor(Math.random() * 26)            // 22..48 px
    const left = Math.random() * 100                            // vw
    const duration = 7 + Math.random() * 10                     // 7..17 s
    const delay = -Math.random() * duration                     // start at random offset
    const dx = (Math.random() - 0.5) * 80                       // horizontal drift in px
    const r0 = `${(Math.random() - 0.5) * 60}deg`
    const r1 = `${(Math.random() - 0.5) * 60 + (Math.random() > 0.5 ? 360 : -360)}deg`
    const opacity = 0.6 + Math.random() * 0.4
    const emoji = CATS[i % CATS.length]
    return { id: i, emoji, size, left, duration, delay, dx, r0, r1, opacity }
  }), [])

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9996,
        pointerEvents: 'none',
        overflow: 'hidden',
        contain: 'strict',
      }}
    >
      {cats.map(c => (
        <span
          key={c.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${c.left}vw`,
            fontSize: c.size,
            opacity: c.opacity,
            lineHeight: 1,
            willChange: 'transform',
            animation: `catRainFall ${c.duration}s linear ${c.delay}s infinite`,
            // CSS variables consumed by the keyframe
            ['--dx']: `${c.dx}px`,
            ['--r0']: c.r0,
            ['--r1']: c.r1,
          }}
        >
          {c.emoji}
        </span>
      ))}
    </div>
  )
}
