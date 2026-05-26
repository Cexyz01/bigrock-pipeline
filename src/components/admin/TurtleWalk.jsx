import { useEffect, useMemo, useState } from 'react'

// Twemoji turtle (MIT). Default orientation: head on the -x side (faces LEFT),
// belly on the +y side (down). All edge transforms below are derived from that.
const TURTLE_SRC = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.0/assets/svg/1f422.svg'

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
  if (document.getElementById('turtle-walk-kf')) return
  const style = document.createElement('style')
  style.id = 'turtle-walk-kf'
  style.textContent = `
    @keyframes turtleWalkXFwd { 0% { transform: translate3d(-12vw, 0, 0); } 100% { transform: translate3d(112vw, 0, 0); } }
    @keyframes turtleWalkXBwd { 0% { transform: translate3d(112vw, 0, 0); } 100% { transform: translate3d(-12vw, 0, 0); } }
    @keyframes turtleWalkYFwd { 0% { transform: translate3d(0, -12vh, 0); } 100% { transform: translate3d(0, 112vh, 0); } }
    @keyframes turtleWalkYBwd { 0% { transform: translate3d(0, 112vh, 0); } 100% { transform: translate3d(0, -12vh, 0); } }
    @keyframes turtleBobUp    { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(0, -3px, 0); } }
    @keyframes turtleBobDown  { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(0,  3px, 0); } }
    @keyframes turtleBobLeft  { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d(-3px, 0, 0); } }
    @keyframes turtleBobRight { 0%, 100% { transform: translate3d(0, 0, 0); } 50% { transform: translate3d( 3px, 0, 0); } }
  `
  document.head.appendChild(style)
}

// dir: +1 means walking in the +x (right) or +y (down) direction along the edge.
// The twemoji SVG faces LEFT by default, so we negate `dir` when picking the
// rotation — otherwise every turtle would walk backwards relative to its motion.
function turtleImgTransform(edge, dir) {
  const d = -dir
  if (edge === 'bottom') return d > 0 ? 'rotate(0deg)' : 'scaleX(-1)'
  if (edge === 'top')    return d > 0 ? 'scaleY(-1)'   : 'rotate(180deg)'
  if (edge === 'right')  return d > 0 ? 'rotate(90deg) scaleY(-1)' : 'rotate(-90deg)'
  return d > 0 ? 'rotate(90deg)' : 'rotate(-90deg) scaleY(-1)'
}

function basePosition(edge, size) {
  switch (edge) {
    case 'bottom': return { bottom: 4, left: 0, width: size, height: size }
    case 'top':    return { top: 4,    left: 0, width: size, height: size }
    case 'left':   return { left: 4,   top: 0,  width: size, height: size }
    case 'right':  return { right: 4,  top: 0,  width: size, height: size }
    default:       return { bottom: 4, left: 0, width: size, height: size }
  }
}

const EDGES = ['bottom', 'top', 'left', 'right']

export default function TurtleWalk() {
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

  const turtles = useMemo(() => {
    const tier = detectTier()
    const count = tier === 'low' ? 8 : 14
    const sizeMin = 28
    const sizeMax = tier === 'low' ? 40 : 52
    return Array.from({ length: count }, (_, i) => {
      const edge = EDGES[i % EDGES.length]
      const dir = Math.random() < 0.5 ? 1 : -1
      const size = sizeMin + Math.floor(Math.random() * (sizeMax - sizeMin))
      const walkDuration = 40 + Math.random() * 35
      const walkDelay = -Math.random() * walkDuration
      const bobDuration = 0.55 + Math.random() * 0.35
      const bobDelay = -Math.random() * bobDuration
      const opacity = 0.78 + Math.random() * 0.22
      return { id: i, edge, dir, size, walkDuration, walkDelay, bobDuration, bobDelay, opacity }
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
        isolation: 'isolate',
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
    >
      {turtles.map(t => {
        const horiz = t.edge === 'top' || t.edge === 'bottom'
        const walkAnim = horiz
          ? (t.dir > 0 ? 'turtleWalkXFwd' : 'turtleWalkXBwd')
          : (t.dir > 0 ? 'turtleWalkYFwd' : 'turtleWalkYBwd')
        const bobAnim = (
          t.edge === 'bottom' ? 'turtleBobUp' :
          t.edge === 'top'    ? 'turtleBobDown' :
          t.edge === 'left'   ? 'turtleBobRight' :
                                'turtleBobLeft'
        )
        const trackStyle = {
          position: 'absolute',
          ...basePosition(t.edge, t.size),
          willChange: 'transform',
          animation: `${walkAnim} ${t.walkDuration}s linear ${t.walkDelay}s infinite`,
          animationPlayState: hidden ? 'paused' : 'running',
        }
        const bouncerStyle = {
          width: '100%',
          height: '100%',
          willChange: 'transform',
          animation: `${bobAnim} ${t.bobDuration}s ease-in-out ${t.bobDelay}s infinite`,
          animationPlayState: hidden ? 'paused' : 'running',
        }
        const imgStyle = {
          width: '100%',
          height: '100%',
          transform: turtleImgTransform(t.edge, t.dir),
          opacity: t.opacity,
          userSelect: 'none',
          display: 'block',
        }
        return (
          <div key={t.id} style={trackStyle}>
            <div style={bouncerStyle}>
              <img
                src={TURTLE_SRC}
                alt=""
                draggable={false}
                decoding="async"
                loading="eager"
                style={imgStyle}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
