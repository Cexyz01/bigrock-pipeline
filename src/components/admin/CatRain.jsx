import { useEffect, useMemo, useState } from 'react'

// SVG cats from Twemoji (Twitter open-source emoji set, MIT licensed).
// We use images instead of OS emoji so every device — Windows, Mac, Linux,
// Android — sees the EXACT same cats. SVGs are also much cheaper to rotate
// than OS color-emoji glyphs (which are bitmap fonts).
const CATS = [
  'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.0/assets/svg/1f408.svg',          // 🐈 cat
  'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.0/assets/svg/1f408-200d-2b1b.svg', // 🐈‍⬛ black cat
]

function detectTier() {
  if (typeof navigator === 'undefined') return 'normal'
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 4
  const coarse = typeof window !== 'undefined'
    && window.matchMedia?.('(pointer: coarse)')?.matches
  if (cores <= 4 || mem <= 4 || coarse) return 'low'
  return 'normal'
}

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
  const [reduced, setReduced] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => { injectKeyframes() }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])

  useEffect(() => {
    const onVis = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const cats = useMemo(() => {
    const tier = detectTier()
    const count = tier === 'low' ? 14 : 24
    const sizeMax = tier === 'low' ? 32 : 44
    const sizeMin = 22
    return Array.from({ length: count }, (_, i) => {
      const size = sizeMin + Math.floor(Math.random() * (sizeMax - sizeMin))
      const left = Math.random() * 100
      const duration = 7 + Math.random() * 10
      const delay = -Math.random() * duration
      const dx = (Math.random() - 0.5) * 80
      const r0 = `${(Math.random() - 0.5) * 60}deg`
      const r1 = `${(Math.random() - 0.5) * 60 + (Math.random() > 0.5 ? 360 : -360)}deg`
      const opacity = 0.6 + Math.random() * 0.4
      const src = CATS[i % CATS.length]
      return { id: i, src, size, left, duration, delay, dx, r0, r1, opacity }
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
        // Isolate compositing so opening modals on top doesn't force the
        // browser to recomposite the rain layer — main cause of lag on Mac.
        isolation: 'isolate',
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
    >
      {cats.map(c => (
        <img
          key={c.id}
          src={c.src}
          alt=""
          draggable={false}
          width={c.size}
          height={c.size}
          decoding="async"
          loading="eager"
          style={{
            position: 'absolute',
            top: 0,
            left: `${c.left}vw`,
            width: c.size,
            height: c.size,
            opacity: c.opacity,
            willChange: 'transform',
            userSelect: 'none',
            animation: `catRainFall ${c.duration}s linear ${c.delay}s infinite`,
            animationPlayState: hidden ? 'paused' : 'running',
            ['--dx']: `${c.dx}px`,
            ['--r0']: c.r0,
            ['--r1']: c.r1,
          }}
        />
      ))}
    </div>
  )
}
