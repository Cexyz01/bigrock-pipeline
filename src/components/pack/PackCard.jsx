import { useRef } from 'react'
import { ScaledCard, RARITY_COLORS } from './CardRenderer'

const DRAG_THRESHOLD = 5

// Inject CSS once
if (typeof document !== 'undefined' && !document.getElementById('pack-card-css')) {
  const s = document.createElement('style')
  s.id = 'pack-card-css'
  s.textContent = `
    @keyframes cardUp {
      from { transform: translateY(0) scale(1); }
      to   { transform: translateY(-4px) scale(1.03); }
    }
    @keyframes cardDown {
      from { transform: translateY(-4px) scale(1.03); }
      to   { transform: translateY(0) scale(1); }
    }
    .pack-card {
      cursor: pointer;
      will-change: transform;
      -webkit-user-select: none;
      user-select: none;
      background: transparent;
      border: 0;
      padding: 0;
      width: 100%;
      text-align: left;
      color: inherit;
      font: inherit;
      display: block;
      position: relative;
      outline: none;
      border-radius: 16px;
    }
    .pack-card:focus-visible {
      box-shadow: 0 0 0 3px rgba(242,140,40,0.55);
    }
    .pack-card:active {
      transform: translateY(0) scale(0.96) !important;
      animation: none !important;
      transition: transform 0.08s ease;
    }
    @keyframes newCollPulse {
      0%, 100% { box-shadow: 0 0 10px rgba(255,45,85,0.6), 0 2px 6px rgba(0,0,0,0.4); }
      50% { box-shadow: 0 0 16px rgba(255,45,85,0.9), 0 2px 8px rgba(0,0,0,0.5); }
    }
  `
  document.head.appendChild(s)
}

function ariaLabelFor(card, owned, copyCount) {
  const name = (card.name || '').replace(/\s*#\d+$/, '') || `Carta #${card.number}`
  const rarity = RARITY_COLORS[card.rarity]?.label || card.rarity
  if (!owned) return `${name}, ${rarity}, non posseduta`
  if (copyCount > 1) return `${name}, ${rarity}, ${copyCount} copie possedute`
  return `${name}, ${rarity}, posseduta`
}

export default function PackCard({
  card, owned, isNew, onSeen, onClick,
  copyInfo, totalCopies, copyCount,
  liftedCount = 0, onLift, onLiftMove, enableDrag = true,
}) {
  const ref = useRef(null)
  const hoveredRef = useRef(false)
  const seenFiredRef = useRef(false)
  const dragRef = useRef(null)
  const visibleCount = Math.max(0, copyCount - liftedCount)
  const allLifted = owned && copyCount > 0 && visibleCount === 0

  const handleEnter = (e) => {
    if (e.pointerType === 'touch') return
    const el = ref.current
    if (!el) return
    hoveredRef.current = true
    el.style.animation = 'none'
    void el.offsetHeight
    el.style.animation = 'cardUp 0.18s cubic-bezier(0.22,1,0.36,1) forwards'

    if (isNew && onSeen && !seenFiredRef.current) {
      seenFiredRef.current = true
      onSeen(card.number)
    }
  }

  const handleLeave = (e) => {
    if (e.pointerType === 'touch') return
    const el = ref.current
    if (!el) return
    hoveredRef.current = false

    const runDown = () => {
      if (hoveredRef.current) return
      el.style.animation = 'cardDown 0.25s cubic-bezier(0.4,0,0.2,1) forwards'
    }

    const anim = el.getAnimations?.()[0]
    if (anim && anim.playState === 'running' && el.style.animation.includes('cardUp')) {
      anim.finished.then(runDown).catch(() => {})
    } else {
      runDown()
    }
  }

  const fireClick = () => {
    if (isNew && onSeen && !seenFiredRef.current) {
      seenFiredRef.current = true
      onSeen(card.number)
    }
    onClick(card, owned)
  }

  const handlePointerDown = (e) => {
    if (e.button != null && e.button !== 0 && e.pointerType === 'mouse') return
    const startX = e.clientX, startY = e.clientY
    dragRef.current = { dragging: false, lifted: false, uid: null }

    const move = (ev) => {
      const s = dragRef.current
      if (!s) return
      const dx = ev.clientX - startX, dy = ev.clientY - startY
      if (!s.dragging && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        s.dragging = true
        if (enableDrag && owned && onLift && visibleCount > 0) {
          const rect = ref.current?.getBoundingClientRect()
          if (rect) {
            s.lifted = true
            s.rectX = rect.left
            s.rectY = rect.top
            s.uid = onLift({
              card,
              x: rect.left,
              y: rect.top,
              width: rect.width,
              copyInfo,
              totalCopies,
            })
            const el = ref.current
            if (el) {
              el.style.animation = 'none'
              el.style.transform = 'none'
              hoveredRef.current = false
            }
          }
        }
      }
      if (s.lifted && s.uid && onLiftMove) {
        onLiftMove(s.uid, s.rectX + (ev.clientX - startX), s.rectY + (ev.clientY - startY))
      }
    }
    const up = () => {
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
      const s = dragRef.current
      dragRef.current = null
      if (s && !s.dragging) fireClick()
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  return (
    <button
      ref={ref}
      type="button"
      className="pack-card"
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      onPointerDown={handlePointerDown}
      aria-label={ariaLabelFor(card, owned, copyCount)}
      aria-disabled={!owned}
      style={{
        opacity: allLifted ? 0.18 : 1,
        transition: 'opacity 0.18s ease',
        touchAction: 'manipulation',
      }}
    >
      <ScaledCard card={card} owned={owned} copyInfo={copyInfo} totalCopies={totalCopies} />

      {isNew && (
        <span style={{
          position: 'absolute', top: -6, left: -4, zIndex: 11,
          transform: 'rotate(-8deg)',
          background: 'linear-gradient(135deg, #FF6B6B, #FF2D55)',
          color: '#fff',
          fontSize: 10, fontWeight: 900, letterSpacing: 0.8,
          padding: '2px 8px', borderRadius: 4,
          boxShadow: '0 0 10px rgba(255,45,85,0.6), 0 2px 6px rgba(0,0,0,0.4)',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
          animation: 'newCollPulse 2s ease-in-out infinite',
          pointerEvents: 'none',
          border: '1.5px solid rgba(255,255,255,0.3)',
        }} aria-hidden>
          NEW
        </span>
      )}

      {owned && visibleCount >= 2 && (
        <span style={{
          position: 'absolute', top: -6, right: -6, zIndex: 10,
          background: '#F28C28', color: '#fff',
          fontSize: 11, fontWeight: 800, lineHeight: '16px',
          padding: '2px 7px', borderRadius: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          border: '2px solid #222',
        }} aria-hidden>
          x{visibleCount}
        </span>
      )}
    </button>
  )
}

export { RARITY_COLORS }
