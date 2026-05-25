import { useEffect, useMemo, useState } from 'react'

// Only the two cats the user wants: orange tabby + black cat
const CATS = ['🐈', '🐈‍⬛']

// Detect low-power devices once. Emojis are expensive to rasterize, so we
// scale the count + size aggressively on weaker machines.
function detectTier() {
  if (typeof navigator === 'undefined') return 'normal'
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 4
  const coarse = typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)')?.matches
  if (cores <= 4 || mem <= 4 || coarse) return 'low'
  return 'normal'
}

// Inject keyframes once. No rotation — rotating a color-emoji glyph forces a
// re-rasterization every frame and is the single biggest cost of this effect.
function injectKeyframes() {
  if (document.getElementById('cat-rain-kf')) return
  const style = document.createElement('style')
  style.id = 'cat-rain-kf'
  style.textContent = `
    @keyframes catRainFall {
      0%   { transform: translate3d(0, -10vh, 0); }
      100% { transform: translate3d(var(--dx), 110vh, 0); }
    }
  `
  document.head.appendChild(style)
}

export default function CatRain() {
  const [reduced, setReduced] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => { injectKeyframes() }, [])

  // Respect the OS "reduce motion" setting → render nothing.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])

  // Pause animation completely when the tab is in the background.
  useEffect(() => {
    const onVis = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const cats = useMemo(() => {
    const tier = detectTier()
    const count = tier === 'low' ? 10 : 18
    const sizeMax = tier === 'low' ? 26 : 32
    const sizeMin = 20
    return Array.from({ length: count }, (_, i) => {
      const size = sizeMin + Math.floor(Math.random() * (sizeMax - sizeMin))
      const left = Math.random() * 100
      const duration = 9 + Math.random() * 9
      const delay = -Math.random() * duration
      const dx = (Math.random() - 0.5) * 60
      const opacity = 0.55 + Math.random() * 0.35
      const emoji = CATS[i % CATS.length]
      return { id: i, emoji, size, left, duration, delay, dx, opacity }
    })
  }, [])

  if (reduced) return null

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
            animationPlayState: hidden ? 'paused' : 'running',
            ['--dx']: `${c.dx}px`,
          }}
        >
          {c.emoji}
        </span>
      ))}
    </div>
  )
}
