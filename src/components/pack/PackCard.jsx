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
  `
  document.head.appendChild(s)
}

export default function PackCard({ card, owned, onClick, copyInfo, totalCopies, copyCount }) {
  const ref = useRef(null)
  const hoveredRef = useRef(false)
  const handleEnter = () => {
    const el = ref.current
    if (!el) return
    hoveredRef.current = true
    el.style.animation = 'none'
    void el.offsetHeight
    el.style.animation = 'cardUp 0.18s cubic-bezier(0.22,1,0.36,1) forwards'
  }

  const handleLeave = () => {
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

  return (
    <div
      ref={ref}
      className="pack-card"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={() => onClick(card, owned)}
      style={{ position: 'relative' }}
    >
      {/* Main card */}
      <ScaledCard card={card} owned={owned} copyInfo={copyInfo} totalCopies={totalCopies} />

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
