import { useRef, useState, useEffect } from 'react'
import { ScaledCard } from './CardRenderer'

const DRAG_THRESHOLD = 5

// Physics
const FRICTION = 0.96          // per-frame velocity multiplier (at 60fps)
const RESTITUTION = 0.62       // edge bounce energy retained
const MIN_VELOCITY = 0.35      // px/frame — below this, flight stops
const MAX_VELOCITY = 90        // px/frame cap (prevents teleporting)
const RELEASE_VELOCITY_MIN = 1.2  // px/frame — below this, no flight on release
const VELOCITY_SAMPLE_MS = 80  // window for averaging release velocity

export default function FloatingCard({ float, onMove, onClick, onPickup, onReturn }) {
  const dragRef = useRef(null)
  const movesRef = useRef([])
  const flightRef = useRef(null)
  const [grabbing, setGrabbing] = useState(false)
  const [flying, setFlying] = useState(false)
  const [hovered, setHovered] = useState(false)

  const handlePointerEnter = (e) => {
    if (e.pointerType === 'touch') return
    setHovered(true)
  }
  const handlePointerLeave = (e) => {
    if (e.pointerType === 'touch') return
    setHovered(false)
  }

  useEffect(() => () => {
    if (flightRef.current) cancelAnimationFrame(flightRef.current)
  }, [])

  const cancelFlight = () => {
    if (flightRef.current) {
      cancelAnimationFrame(flightRef.current)
      flightRef.current = null
      setFlying(false)
    }
  }

  const startFlight = (vx, vy, startX, startY) => {
    let curX = startX, curY = startY
    const speed0 = Math.hypot(vx, vy)
    if (speed0 > MAX_VELOCITY) {
      const k = MAX_VELOCITY / speed0
      vx *= k; vy *= k
    }
    const w = float.width
    const h = float.width * 1.4 // card aspect 2.5/3.5
    let lastT = performance.now()
    setFlying(true)

    const tick = (t) => {
      const dt = Math.min((t - lastT) / 16.6667, 3)
      lastT = t
      curX += vx * dt
      curY += vy * dt
      const f = Math.pow(FRICTION, dt)
      vx *= f
      vy *= f
      const W = window.innerWidth
      const H = window.innerHeight
      if (curX < 0) { curX = 0; vx = Math.abs(vx) * RESTITUTION }
      else if (curX + w > W) { curX = W - w; vx = -Math.abs(vx) * RESTITUTION }
      if (curY < 0) { curY = 0; vy = Math.abs(vy) * RESTITUTION }
      else if (curY + h > H) { curY = H - h; vy = -Math.abs(vy) * RESTITUTION }

      onMove(float.uid, curX, curY)

      if (Math.hypot(vx, vy) > MIN_VELOCITY) {
        flightRef.current = requestAnimationFrame(tick)
      } else {
        flightRef.current = null
        setFlying(false)
      }
    }
    flightRef.current = requestAnimationFrame(tick)
  }

  const handleContextMenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    cancelFlight()
    if (onReturn) onReturn(float.uid)
  }

  const handlePointerDown = (e) => {
    if (e.button != null && e.button !== 0 && e.pointerType === 'mouse') return
    e.stopPropagation()
    cancelFlight()

    const startX = e.clientX, startY = e.clientY
    const origX = float.x, origY = float.y
    dragRef.current = { dragging: false }
    movesRef.current = [{ x: startX, y: startY, t: performance.now() }]
    if (onPickup) onPickup(float.uid)

    const move = (ev) => {
      const s = dragRef.current
      if (!s) return
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!s.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        s.dragging = true
        setGrabbing(true)
      }
      if (s.dragging) {
        onMove(float.uid, origX + dx, origY + dy)
        const t = performance.now()
        movesRef.current.push({ x: ev.clientX, y: ev.clientY, t })
        const cutoff = t - VELOCITY_SAMPLE_MS
        while (movesRef.current.length > 2 && movesRef.current[0].t < cutoff) {
          movesRef.current.shift()
        }
      }
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      const dragging = dragRef.current?.dragging
      dragRef.current = null
      setGrabbing(false)
      if (!dragging) {
        if (onClick) onClick(float)
        return
      }
      // Release velocity from sample window
      const moves = movesRef.current
      if (moves.length >= 2) {
        const first = moves[0], last = moves[moves.length - 1]
        const dt = last.t - first.t
        if (dt > 0) {
          const vx = ((last.x - first.x) / dt) * 16.6667
          const vy = ((last.y - first.y) / dt) * 16.6667
          if (Math.hypot(vx, vy) > RELEASE_VELOCITY_MIN) {
            const lastNx = origX + (last.x - startX)
            const lastNy = origY + (last.y - startY)
            startFlight(vx, vy, lastNx, lastNy)
          }
        }
      }
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      style={{
        position: 'fixed',
        left: float.x,
        top: float.y,
        width: float.width,
        zIndex: float.z || 8500,
        cursor: grabbing ? 'grabbing' : 'grab',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        filter: grabbing || flying
          ? 'drop-shadow(0 22px 36px rgba(0,0,0,0.55))'
          : hovered
            ? 'drop-shadow(0 18px 30px rgba(0,0,0,0.5))'
            : 'drop-shadow(0 14px 28px rgba(0,0,0,0.45))',
        transform: grabbing
          ? 'translateY(0) scale(1.04)'
          : hovered && !flying
            ? 'translateY(-4px) scale(1.03)'
            : 'translateY(0) scale(1)',
        transition: 'transform 0.22s cubic-bezier(0.22,1,0.36,1), filter 0.22s ease',
        willChange: 'left, top, transform',
      }}
    >
      <ScaledCard
        card={float.card}
        owned={true}
        copyInfo={float.copyInfo}
        totalCopies={float.totalCopies}
      />
    </div>
  )
}
