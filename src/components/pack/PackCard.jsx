import { useRef } from 'react'
import { ScaledCard, RARITY_COLORS } from './CardRenderer'

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

export default function PackCard({ card, owned, isNew, onSeen, onClick, copyInfo, totalCopies, copyCount }) {
  const ref = useRef(null)
  const hoveredRef = useRef(false)
  const seenFiredRef = useRef(false)

  const handleEnter = (e) => {
    if (e.pointerType === 'touch') return
    const el = ref.current
    if (!el) return
    hoveredRef.current = true
    el.style.animation = 'none'
    void el.offsetHeight
    el.style.animation = 'cardUp 0.18s cubic-bezier(0.22,1,0.36,1) forwards'

    // Mark card as seen on first hover
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

  // Mobile: mark seen on click/tap too
  const handleClick = () => {
    if (isNew && onSeen && !seenFiredRef.current) {
      seenFiredRef.current = true
      onSeen(card.number)
    }
    onClick(card, owned)
  }

  return (
    <div
      ref={ref}
      className="pack-card"
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      onClick={handleClick}
      style={{ position: 'relative' }}
    >
      {/* Main card */}
      <ScaledCard card={card} owned={owned} copyInfo={copyInfo} totalCopies={totalCopies} />

      {/* NEW badge */}
      {isNew && (
        <div style={{
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
        }}>
          NEW
        </div>
      )}

      {/* Copy count badge */}
      {owned && copyCount >= 2 && (
        <div style={{
          position: 'absolute', top: -6, right: -6, zIndex: 10,
          background: '#F28C28', color: '#fff',
          fontSize: 11, fontWeight: 800, lineHeight: '16px',
          padding: '2px 7px', borderRadius: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          border: '2px solid #222',
        }}>
          x{copyCount}
        </div>
      )}
    </div>
  )
}

export { RARITY_COLORS }
