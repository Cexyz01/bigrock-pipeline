import { useEffect, useRef, useState } from 'react'

// Cartoon "peek-a-boo": the character leans into the screen from a random edge,
// settles with a rubbery overshoot, stares for a few seconds, then darts away
// after a quick anticipation crouch — like a cartoon poking its head around a
// doorframe. Admin-only fun. Source art is a transparent cutout (638x688).
const SRC = '/images/alvise.png'

// Head leads into the screen interior. Art faces head-up, so we rotate so the
// head points inward and the legs trail off-screen beyond the edge — revealing
// just head + torso (a mezzobusto).
const BASE_ROT = { bottom: 0, top: 180, left: 90, right: -90 }
const EDGES = ['top', 'bottom', 'left', 'right']

// % of the element's own box, relative to the anchored edge.
// peek/antic = how much stays hidden beyond the edge (smaller = more visible).
const AMT = { hidden: 118, peek: 30, antic: 18 }

function slide(edge, kind) {
  const v = AMT[kind] ?? AMT.hidden
  switch (edge) {
    case 'left':  return `translateX(-${v}%)`
    case 'right': return `translateX(${v}%)`
    case 'top':   return `translateY(-${v}%)`
    default:      return `translateY(${v}%)` // bottom
  }
}

const TRANSITION = {
  hidden: 'none',
  // gommoso: back-out overshoot on the way in
  peek:   'transform .5s cubic-bezier(.34, 1.56, .64, 1)',
  // brief anticipation crouch
  antic:  'transform .15s ease-out',
  // fast dart out with a touch of anticipation easing
  gone:   'transform .34s cubic-bezier(.6, -.28, .74, .05)',
}
const PHASE_KIND = { hidden: 'hidden', peek: 'peek', antic: 'antic', gone: 'hidden' }

function injectKeyframes() {
  if (document.getElementById('alvise-peek-kf')) return
  const style = document.createElement('style')
  style.id = 'alvise-peek-kf'
  style.textContent = `
    @keyframes alvisePeekSway {
      0%, 100% { transform: translateY(0) rotate(-1.4deg); }
      50%      { transform: translateY(-2px) rotate(1.4deg); }
    }
  `
  document.head.appendChild(style)
}

function randomConfig() {
  const edge = EDGES[Math.floor(Math.random() * EDGES.length)]
  const horiz = edge === 'top' || edge === 'bottom'
  const alongPct = horiz ? 2 + Math.random() * 66 : 2 + Math.random() * 56
  const size = 300 + Math.floor(Math.random() * 100)
  const mirror = Math.random() < 0.5
  const tilt = (Math.random() * 20 - 10) // ±10°
  return { edge, alongPct, size, mirror, tilt }
}

const rand = (min, max) => min + Math.random() * (max - min)

export default function CharacterPeek() {
  const [reduced, setReduced] = useState(false)
  const [cfg, setCfg] = useState(null)
  const [phase, setPhase] = useState('hidden')
  const timers = useRef([])
  const rafRef = useRef(0)

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
    if (reduced) return
    let alive = true
    const push = (fn, ms) => { const id = setTimeout(fn, ms); timers.current.push(id); return id }

    const runCycle = () => {
      if (!alive) return
      const c = randomConfig()
      setCfg(c)
      setPhase('hidden')
      // place off-screen first, then animate in on the next frame
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => { if (alive) setPhase('peek') })
      })
      const enterMs = 520
      const holdMs = rand(3000, 4800)
      const anticMs = 160
      const exitMs = 360
      const gapMs = rand(24000, 36000)
      push(() => setPhase('antic'), enterMs + holdMs)
      push(() => setPhase('gone'), enterMs + holdMs + anticMs)
      push(runCycle, enterMs + holdMs + anticMs + exitMs + gapMs)
    }

    push(runCycle, rand(18000, 30000))
    return () => {
      alive = false
      timers.current.forEach(clearTimeout)
      timers.current = []
      cancelAnimationFrame(rafRef.current)
    }
  }, [reduced])

  if (reduced || !cfg) return null

  const horiz = cfg.edge === 'top' || cfg.edge === 'bottom'
  const pos = cfg.edge === 'left'  ? { left: 0,   top: `${cfg.alongPct}%` }
            : cfg.edge === 'right' ? { right: 0,  top: `${cfg.alongPct}%` }
            : cfg.edge === 'top'   ? { top: 0,    left: `${cfg.alongPct}%` }
            :                        { bottom: 0, left: `${cfg.alongPct}%` }

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', inset: 0, zIndex: 9994,
        pointerEvents: 'none', overflow: 'hidden', contain: 'strict',
      }}
    >
      <div
        style={{
          position: 'absolute',
          ...pos,
          width: cfg.size, height: cfg.size,
          transform: slide(cfg.edge, PHASE_KIND[phase]),
          transition: TRANSITION[phase],
          willChange: 'transform',
        }}
      >
        <div
          style={{
            width: '100%', height: '100%',
            animation: 'alvisePeekSway 3.2s ease-in-out infinite',
            willChange: 'transform',
          }}
        >
          <img
            src={SRC}
            alt=""
            draggable={false}
            decoding="async"
            loading="eager"
            style={{
              width: '100%', height: '100%',
              objectFit: 'contain',
              // Mirror for variety must flip ALONG the edge, not across the
              // head→interior axis — otherwise on left/right edges it swaps
              // head and legs and the character peeks in upside-down/feet-first.
              transform: `${cfg.mirror ? (horiz ? 'scaleX(-1) ' : 'scaleY(-1) ') : ''}rotate(${BASE_ROT[cfg.edge] + cfg.tilt}deg)`,
              filter: 'drop-shadow(0 6px 16px rgba(0,0,0,.30))',
              userSelect: 'none', display: 'block',
            }}
          />
        </div>
      </div>
    </div>
  )
}
