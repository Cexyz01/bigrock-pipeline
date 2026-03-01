import { useState, useRef, useCallback, useEffect, memo, useMemo } from 'react'
import { RARITY_COLORS } from './PackCard'
import { ScaledCard } from './CardRenderer'
import useIsMobile from '../../hooks/useIsMobile'

const RARITY_RANK = { common: 0, rare: 1, gold: 2, diamond: 3, rainbow: 4 }

// Particle & glow — SCREEN-WIDE effects
const RARITY_FX = {
  common:  { glow: '0 0 40px rgba(100,116,139,0.4)', particles: 0,  pSize: 0,  dist: 0,    bg: '#2d2d2d' },
  rare:    { glow: '0 0 60px rgba(34,197,94,0.6), 0 0 120px rgba(34,197,94,0.2)',       particles: 24,  pSize: 8,  dist: 600,  bg: '#14532D' },
  gold:    { glow: '0 0 80px rgba(245,158,11,0.6), 0 0 160px rgba(245,158,11,0.25)',   particles: 36,  pSize: 10, dist: 800,  bg: '#422006' },
  diamond: { glow: '0 0 100px rgba(6,182,212,0.7), 0 0 200px rgba(6,182,212,0.3)',     particles: 50,  pSize: 12, dist: 1000, bg: '#083344' },
  rainbow: { glow: '0 0 120px rgba(236,72,153,0.7), 0 0 200px rgba(139,92,246,0.4), 0 0 280px rgba(245,158,11,0.2)', particles: 70, pSize: 14, dist: 1200, bg: '#500724' },
}

// Orb escalation tiers — each tier builds suspense before reveal
const ORB_TIERS = [
  { tier: 'rare',    rank: 1, duration: 700 },
  { tier: 'gold',    rank: 2, duration: 1050 },
  { tier: 'diamond', rank: 3, duration: 1400 },
  { tier: 'rainbow', rank: 4, duration: 2100 },
]
const ORB_BURST_MS = 200

export default function PackOpening({ pack, cards, onClose, packType, copiesPerRarity, flyRect, preOpenOwned }) {
  const isMobile = useIsMobile()
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [phase, setPhase] = useState('idle')       // idle | entering | exiting | waiting | orb
  const [revealKey, setRevealKey] = useState(0)
  const [particleKey, setParticleKey] = useState(0)
  const [tiltX, setTiltX] = useState(0)
  const [tiltY, setTiltY] = useState(0)
  const [orbTier, setOrbTier] = useState(null)     // null | 'rare' | 'gold' | 'diamond' | 'rainbow'
  const [orbBurst, setOrbBurst] = useState(false)
  const [orbPrePop, setOrbPrePop] = useState(false)
  const [showParticles, setShowParticles] = useState(false)
  const [packClicked, setPackClicked] = useState(false)
  const [flyPhase, setFlyPhase] = useState(flyRect ? 'flying' : 'landed') // flying → landed
  const [flyAnimated, setFlyAnimated] = useState(false) // triggers transition to center
  const cardRef = useRef(null)
  const enterStartRef = useRef(0)
  const enterTimerRef = useRef(null)
  const preClickRef = useRef(null)
  const queuedOpenRef = useRef(false)

  // Fly transition: start at source rect, animate to center (350ms)
  useEffect(() => {
    if (flyPhase === 'flying') {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setFlyAnimated(true))
      })
      const t = setTimeout(() => setFlyPhase('landed'), 350)
      return () => clearTimeout(t)
    }
  }, [flyPhase])

  // Queued open: if user clicked during fly, auto-open when fly done + pack loaded
  useEffect(() => {
    if (!queuedOpenRef.current) return
    if (flyPhase === 'flying' || !pack || packClicked || currentIdx !== -1) return
    queuedOpenRef.current = false
    setPackClicked(true)
    setTimeout(() => {
      setPackClicked(false)
      setCurrentIdx(0)
      const nextRarity = getCardRarity(sortedCards[0]?.card, cards)
      startOrbSequence(nextRarity)
    }, 250)
  }, [flyPhase, pack])

  const sortedCards = [...(pack?.cards || [])].sort(
    (a, b) => (RARITY_RANK[getCardRarity(a.card, cards)] || 0) - (RARITY_RANK[getCardRarity(b.card, cards)] || 0)
  )
  const totalCards = sortedCards.length

  function getCardRarity(cardNum, allCards) {
    const c = allCards.find(cc => cc.number === cardNum)
    return c?.rarity || 'common'
  }

  // Current card object for particle FX
  const currentCard = currentIdx >= 0 ? cards.find(c => c.number === sortedCards[currentIdx]?.card) : null

  // Desktop: tilt always follows mouse (no click needed)
  // Mobile: tilt only while finger is dragging, resets on release
  const touchActiveRef = useRef(false)
  const tiltRafRef = useRef(null)
  const touchStartRef = useRef(null)

  // Mouse tilt — always follows cursor (desktop behavior)
  const handleMouseMove = useCallback((e) => {
    if (touchActiveRef.current) return // ignore mouse compat events during/after touch
    if (flyPhase === 'flying') return
    const vcx = window.innerWidth / 2
    const vcy = window.innerHeight / 2
    const nx = (e.clientX - vcx) / vcx
    const ny = (e.clientY - vcy) / vcy
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
    setTiltY(clamp(nx * 25, -25, 25))
    setTiltX(clamp(ny * -20, -20, 20))
  }, [flyPhase])

  // Touch tilt — drag to tilt, release resets (RAF-throttled)
  const handleTouchStart = useCallback((e) => {
    touchActiveRef.current = true
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
  }, [])
  const handleTouchMove = useCallback((e) => {
    if (flyPhase === 'flying' || !touchStartRef.current) return
    const t = e.touches[0]
    const dx = t.clientX - touchStartRef.current.x
    const dy = t.clientY - touchStartRef.current.y
    if (tiltRafRef.current) return
    tiltRafRef.current = requestAnimationFrame(() => {
      tiltRafRef.current = null
      const clamp = (v, min, max) => Math.max(min, Math.min(max, v))
      setTiltY(clamp(dx * 0.15, -25, 25))
      setTiltX(clamp(dy * -0.15, -20, 20))
    })
  }, [flyPhase])
  const handleTouchEnd = useCallback(() => {
    touchStartRef.current = null
    if (tiltRafRef.current) { cancelAnimationFrame(tiltRafRef.current); tiltRafRef.current = null }
    setTiltX(0); setTiltY(0)
    // Keep touchActiveRef true briefly to block mouse compat events
    setTimeout(() => { touchActiveRef.current = false }, 400)
  }, [])

  // Orb sequence: escalate through rarity tiers, then reveal card
  function startOrbSequence(targetRarity) {
    const targetRank = RARITY_RANK[targetRarity] || 0
    setShowParticles(false) // Hide particles during orb

    // Common cards skip orb — instant flip, no pause
    if (targetRank === 0) {
      setShowParticles(true)
      setParticleKey(k => k + 1)
      setRevealKey(k => k + 1)
      setPhase('entering')
      enterStartRef.current = Date.now()
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
      enterTimerRef.current = setTimeout(() => setPhase('idle'), 700)
      return
    }

    // Non-common: enter orb phase and step through tiers
    setPhase('orb')
    let tierIdx = 0

    const PRE_POP_MS = 300

    function stepTier() {
      const { tier, rank, duration } = ORB_TIERS[tierIdx]
      setOrbTier(tier)
      setOrbBurst(false)
      setOrbPrePop(false)

      setTimeout(() => {
        // Pre-pop pulse before any transition
        setOrbPrePop(true)
        setTimeout(() => {
          setOrbPrePop(false)
          // If this tier matches the card's rarity → finish orb, reveal card
          if (rank >= targetRank) {
            finishOrb()
            return
          }
          // Otherwise: burst flash then escalate to next tier
          setOrbBurst(true)
          setTimeout(() => {
            tierIdx++
            stepTier()
          }, ORB_BURST_MS)
        }, PRE_POP_MS)
      }, duration)
    }

    function finishOrb() {
      setOrbTier(null)
      setOrbBurst(false)
      setOrbPrePop(false)
      setShowParticles(true)
      setParticleKey(k => k + 1)
      setRevealKey(k => k + 1)
      setPhase('entering')
      enterStartRef.current = Date.now()
      if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
      enterTimerRef.current = setTimeout(() => setPhase('idle'), 700)
    }

    stepTier()
  }

  const executeClick = () => {
    if (enterTimerRef.current) clearTimeout(enterTimerRef.current)
    if (preClickRef.current) { clearTimeout(preClickRef.current); preClickRef.current = null }

    if (!pack) return
    if (currentIdx === -1) {
      setPackClicked(true)
      setTimeout(() => {
        setPackClicked(false)
        setCurrentIdx(0)
        const nextRarity = getCardRarity(sortedCards[0]?.card, cards)
        startOrbSequence(nextRarity)
      }, 350)
    } else if (currentIdx < totalCards - 1) {
      setPhase('exiting')
      setShowParticles(false)
      setTimeout(() => {
        const nextIdx = currentIdx + 1
        setCurrentIdx(nextIdx)
        const nextRarity = getCardRarity(sortedCards[nextIdx]?.card, cards)
        startOrbSequence(nextRarity)
      }, 400)
    } else {
      onClose()
    }
  }

  const handleClick = (e) => {
    if (phase === 'exiting' || phase === 'waiting' || phase === 'orb' || packClicked) return
    // During fly: queue the open — effect auto-fires when ready
    if (flyPhase === 'flying') {
      queuedOpenRef.current = true
      return
    }
    // During enter animation: buffer click between 10%-50%, allow after 50%
    if (phase === 'entering') {
      const elapsed = Date.now() - enterStartRef.current
      if (elapsed < 70) return // < 10%: ignore
      if (elapsed < 350) {
        // 10%-50%: buffer — schedule executeClick at the 350ms mark
        if (!preClickRef.current) {
          preClickRef.current = setTimeout(() => {
            preClickRef.current = null
            executeClick()
          }, 350 - elapsed)
        }
        return
      }
      // >= 50%: immediate
    }
    executeClick()
  }

  const pt = { red: '#EF4444', green: '#22C55E', blue: '#3B82F6' }[packType] || '#F28C28'

  return (
    <div
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { if (!touchActiveRef.current) { setTiltX(0); setTiltY(0) } }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(10,10,10,0.96)',
        backdropFilter: 'blur(16px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        userSelect: 'none', WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
    >
      {currentIdx === -1 ? (() => {
        const isFlying = flyPhase === 'flying' && flyRect
        return (
          <>
            {/* Pack — single persistent DOM node, fly→land seamless */}
            <div style={{
              position: 'fixed',
              left: (isFlying && !flyAnimated) ? flyRect.left + flyRect.width / 2 : '50%',
              top: (isFlying && !flyAnimated) ? flyRect.top + flyRect.height / 2 : '50%',
              width: (isFlying && !flyAnimated) ? flyRect.width : (isMobile ? '65vw' : 380),
              maxWidth: isMobile ? '65vw' : 380,
              transform: 'translate(-50%, -50%)',
              transition: isFlying
                ? 'left 0.3s cubic-bezier(0.4,0,0.2,1), top 0.3s cubic-bezier(0.4,0,0.2,1), width 0.3s cubic-bezier(0.4,0,0.2,1)'
                : 'none',
              zIndex: 10,
            }}>
              {/* Tilt wrapper — mouse-follow 3D perspective */}
              <div style={{
                transform: (!isFlying && !packClicked)
                  ? `perspective(800px) rotateX(${tiltX * 0.6}deg) rotateY(${tiltY * 0.6}deg) scale(${1 + (Math.abs(tiltX) + Math.abs(tiltY)) * 0.001})`
                  : 'perspective(800px) rotateX(0deg) rotateY(0deg)',
                transition: 'transform 0.12s ease-out',
                transformStyle: 'preserve-3d',
              }}>
                <div style={{
                  filter: `drop-shadow(0 0 ${60 + (Math.abs(tiltX) + Math.abs(tiltY)) * 0.5}px ${pt}60)`,
                  transformOrigin: 'center center',
                  ...(isFlying ? {
                    transform: flyAnimated ? 'rotate(0deg)' : 'rotate(5deg)',
                    transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                  } : {
                    animation: packClicked
                      ? 'poPackOpen 0.35s ease forwards'
                      : !flyRect
                        ? 'poEntrance 0.5s ease'
                        : undefined,
                  }),
                }}>
                  <img
                    src={`/packs/pack_${packType}.png`}
                    alt="Pack"
                    draggable={false}
                    style={{ width: '100%', display: 'block', borderRadius: 16 }}
                  />
                </div>
              </div>
            </div>
            {/* Click hint — appears after landing */}
            {!isFlying && (
              <div style={{
                position: 'fixed',
                left: '50%',
                bottom: 'calc(50% - 290px)',
                transform: 'translateX(-50%)',
                fontSize: 20, color: '#CBD5E1', fontWeight: 600,
                animation: 'poPulse 2s ease-in-out infinite',
                opacity: packClicked ? 0 : (!pack ? 0.4 : 1),
                transition: 'opacity 0.2s ease',
                zIndex: 10,
              }}>
                {!pack ? 'Loading...' : 'Click to open'}
              </div>
            )}
          </>
        )
      })() : (
        /* ─── CARD REVEAL ─── */
        <div style={{ position: 'relative', width: isMobile ? '70vw' : 320, maxWidth: isMobile ? '70vw' : 320 }}>
          {/* Progress dots — current dot colors only AFTER reveal (phase idle) */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
            {sortedCards.map((_, i) => {
              const rarityColor = RARITY_COLORS[getCardRarity(sortedCards[i]?.card, cards)]?.border || '#64748B'
              const isPast = i < currentIdx
              const isCurrent = i === currentIdx
              const isRevealed = isCurrent && phase === 'idle'
              const showColor = isPast || isRevealed
              return (
                <div key={i} style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: showColor ? rarityColor : isCurrent ? '#475569' : '#2d2d2d',
                  border: showColor || isCurrent ? 'none' : '1px solid #3a3a3a',
                  transition: 'all 0.4s ease',
                  boxShadow: isRevealed
                    ? `0 0 12px ${rarityColor}80`
                    : isCurrent
                      ? '0 0 8px rgba(71,85,105,0.5)'
                      : 'none',
                }} />
              )
            })}
          </div>

          {/* Card area — aspect ratio wrapper for orb + glow + card */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '2.5 / 3.5' }}>

            {/* Rarity Escalation Orb — shown during 'orb' phase */}
            {phase === 'orb' && orbTier && (
              <RarityOrb tier={orbTier} burst={orbBurst} prePop={orbPrePop} />
            )}

            {/* Glow — OUTSIDE tilt wrapper, does NOT follow mouse tilt */}
            {currentCard && phase !== 'orb' && phase !== 'exiting' && (
              <CardGlow card={currentCard} />
            )}

            {/* Tilt layer — ALWAYS follows mouse, never interrupted by animations */}
            <div
              ref={cardRef}
              style={{
                position: 'relative', width: '100%', height: '100%',
                zIndex: 2,
                transform: `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
                transition: 'transform 0.15s ease-out',
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Flip animation layer — independent from tilt */}
              <div style={{
                width: '100%', height: '100%',
                animation: phase === 'exiting'
                  ? 'poCardExit 0.4s ease-in forwards'
                  : phase === 'entering'
                    ? 'poCardEnter 0.6s cubic-bezier(0.4,0,0.2,1) forwards'
                    : 'none',
                opacity: (phase === 'waiting' || phase === 'orb') ? 0 : undefined,
                transformStyle: 'preserve-3d',
              }}>
                <CardReveal
                  key={revealKey}
                  entry={sortedCards[currentIdx]}
                  card={currentCard}
                  copiesPerRarity={copiesPerRarity}
                  isNew={currentCard && preOpenOwned ? !preOpenOwned.has(currentCard.number) : false}
                  tiltX={tiltX}
                  tiltY={tiltY}
                />
              </div>
            </div>
          </div>

          {/* Hint */}
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#94A3B8', fontWeight: 500 }}>
            {currentIdx < totalCards - 1 ? `Carta ${currentIdx + 1}/${totalCards} — clicca per continuare` : 'Clicca per chiudere'}
          </div>
        </div>
      )}

      {/* ─── Particles — OVERLAY LEVEL, pure 2D, completely separate from card 3D ─── */}
      {showParticles && currentCard && (
        <ParticlesFX key={particleKey} card={currentCard} />
      )}

      {/* ─── Animations ─── */}
      <style>{`
        @keyframes poEntrance {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes poPackOpen {
          0%   { transform: scale(1); opacity: 1; }
          30%  { transform: scale(0.88); opacity: 1; }
          100% { transform: scale(1.2) rotate(3deg); opacity: 0; }
        }
        @keyframes poPendulum {
          0%   { transform: rotate(0deg); }
          25%  { transform: rotate(5deg); }
          75%  { transform: rotate(-5deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes poPulse {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        @keyframes poCardExit {
          0%   { transform: rotateY(0deg) scale(1); opacity: 1; }
          100% { transform: rotateY(90deg) scale(0.85); opacity: 0; }
        }
        @keyframes poCardEnter {
          0%   { transform: rotateY(-90deg) scale(0.85); opacity: 0; }
          40%  { transform: rotateY(5deg) scale(1.04); opacity: 1; }
          70%  { transform: rotateY(-2deg) scale(1.01); opacity: 1; }
          100% { transform: rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes poGlowPulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.08); }
        }
        @keyframes poSparkle {
          0%   { transform: translate(0,0) scale(0); opacity: 0; }
          10%  { opacity: 0; }
          18%  { opacity: 1; }
          45%  { opacity: 0.9; }
          100% { transform: translate(var(--dx), var(--dy)) scale(1.5); opacity: 0; }
        }
        @keyframes poRainbowSpin {
          to { --rainbow-angle: 360deg; }
        }
        @property --rainbow-angle {
          syntax: '<angle>';
          inherits: false;
          initial-value: 0deg;
        }
        @property --diamond-angle {
          syntax: '<angle>';
          inherits: false;
          initial-value: 0deg;
        }
        .diamond-border-wrap {
          animation: poDiamondSpin 4s linear infinite;
        }
        @keyframes poDiamondSpin {
          to { --diamond-angle: 360deg; }
        }
        @keyframes poOrbPulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50%      { transform: scale(1.12); filter: brightness(1.3); }
        }
        @keyframes poOrbEntrance {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes poOrbBurst {
          0%   { transform: scale(1); filter: brightness(1); }
          50%  { transform: scale(1.6); filter: brightness(2.5); }
          100% { transform: scale(1); filter: brightness(1); }
        }
        @keyframes poOrbBurstFlash {
          0%   { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes poOrbFloat {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-6px); }
        }
        @keyframes newBadgePulse {
          0%, 100% { box-shadow: 0 0 12px rgba(255,45,85,0.7), 0 0 24px rgba(255,45,85,0.4); }
          50%      { box-shadow: 0 0 18px rgba(255,45,85,0.9), 0 0 36px rgba(255,45,85,0.6); }
        }
        @keyframes poOrbAppear {
          0%   { transform: scale(0); opacity: 0; filter: brightness(1.8); }
          45%  { transform: scale(1.1); opacity: 1; filter: brightness(1.3); }
          65%  { transform: scale(1.05); opacity: 1; filter: brightness(1.15); }
          82%  { transform: scale(0.98); opacity: 1; filter: brightness(1.05); }
          100% { transform: scale(1); opacity: 1; filter: brightness(1); }
        }
        @keyframes poOrbGlowAppear {
          0%   { transform: scale(0); opacity: 0; }
          45%  { transform: scale(1.1); opacity: 0.6; }
          70%  { transform: scale(1.02); opacity: 0.5; }
          100% { transform: scale(1); opacity: 0.5; }
        }
        @keyframes poOrbRingAppear {
          0%   { transform: scale(0); opacity: 0; }
          50%  { transform: scale(1.06); opacity: 0.75; }
          100% { transform: scale(1); opacity: 0.7; }
        }
        @keyframes poOrbPrePop {
          0%   { transform: scale(1); filter: brightness(1); }
          50%  { transform: scale(1.18); filter: brightness(1.5); }
          100% { transform: scale(1); filter: brightness(1.8); }
        }
      `}</style>
    </div>
  )
}

/* ─── Rarity Escalation Orb — 3D glowing sphere ─── */
function RarityOrb({ tier, burst, prePop }) {
  if (!tier) return null

  const TIER_COLORS = {
    rare:    { main: '#22C55E', light: '#86EFAC', dark: '#14532D', glow: 'rgba(34,197,94,0.6)',  ring: 'rgba(34,197,94,0.3)'  },
    gold:    { main: '#F59E0B', light: '#FDE68A', dark: '#92400E', glow: 'rgba(245,158,11,0.6)',  ring: 'rgba(245,158,11,0.3)'  },
    diamond: { main: '#06B6D4', light: '#A5F3FC', dark: '#164E63', glow: 'rgba(6,182,212,0.7)',   ring: 'rgba(6,182,212,0.35)'  },
    rainbow: { main: '#EC4899', light: '#FBCFE8', dark: '#831843', glow: 'rgba(236,72,153,0.7)',  ring: 'rgba(139,92,246,0.35)' },
  }

  const c = TIER_COLORS[tier] || TIER_COLORS.rare
  const isRainbow = tier === 'rainbow'
  const isDiamond = tier === 'diamond'

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 5,
      pointerEvents: 'none',
    }}>
      {/* Outer ambient glow — large soft aura */}
      <div style={{
        position: 'absolute',
        width: 280, height: 280,
        borderRadius: '50%',
        background: isRainbow
          ? 'conic-gradient(from var(--rainbow-angle, 0deg), #EC489944, #F59E0B44, #22C55E44, #3B82F644, #8B5CF644, #EC489944)'
          : `radial-gradient(circle, ${c.glow} 0%, ${c.ring} 40%, transparent 70%)`,
        animation: prePop
          ? 'poOrbPrePop 0.3s ease-in-out'
          : isRainbow
            ? 'poOrbGlowAppear 0.5s ease-out, poOrbPulse 1.5s 0.5s ease-in-out infinite, poRainbowSpin 2s linear infinite'
            : 'poOrbGlowAppear 0.5s ease-out, poOrbPulse 1.5s 0.5s ease-in-out infinite',
        opacity: 0.5,
      }} />

      {/* Inner glow ring — tighter, brighter */}
      <div style={{
        position: 'absolute',
        width: 140, height: 140,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${c.glow} 0%, transparent 70%)`,
        animation: prePop
          ? 'poOrbPrePop 0.3s ease-in-out'
          : 'poOrbRingAppear 0.4s 0.05s ease-out both, poOrbPulse 1.2s 0.4s ease-in-out infinite',
        opacity: 0.7,
      }} />

      {/* Core orb — 3D sphere with specular highlight */}
      <div style={{
        position: 'relative',
        width: 90, height: 90,
        borderRadius: '50%',
        background: isRainbow
          ? 'conic-gradient(from var(--rainbow-angle, 0deg), #EC4899, #F59E0B, #22C55E, #3B82F6, #8B5CF6, #EC4899)'
          : `radial-gradient(circle at 38% 32%, ${c.light} 0%, ${c.main} 35%, ${c.dark} 100%)`,
        boxShadow: [
          `0 0 30px ${c.glow}`,
          `0 0 60px ${c.glow}`,
          `0 0 100px ${c.ring}`,
          `inset 0 -8px 20px ${c.dark}AA`,
          `inset 0 4px 12px ${c.light}66`,
        ].join(', '),
        animation: burst
          ? 'poOrbBurst 0.2s ease-out forwards'
          : prePop
            ? 'poOrbPrePop 0.3s ease-in-out forwards'
            : 'poOrbAppear 0.45s cubic-bezier(0.25, 1, 0.5, 1), poOrbFloat 2.5s 0.45s ease-in-out infinite',
        overflow: 'hidden',
      }}>
        {/* Diamond shimmer overlay — rotating conic on top of 3D sphere */}
        {isDiamond && (
          <div style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: 'conic-gradient(from var(--diamond-angle, 0deg), transparent, rgba(255,255,255,0.35) 15%, transparent 30%, rgba(165,243,252,0.3) 50%, transparent 65%, rgba(255,255,255,0.3) 80%, transparent)',
            animation: 'poDiamondSpin 3s linear infinite',
            mixBlendMode: 'overlay',
          }} />
        )}
        {/* Specular highlight — white gloss on top-left */}
        <div style={{
          position: 'absolute',
          top: 10, left: 16,
          width: 32, height: 20,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
          transform: 'rotate(-20deg)',
          pointerEvents: 'none',
        }} />
        {/* Secondary highlight — bottom right rim */}
        <div style={{
          position: 'absolute',
          bottom: 14, right: 14,
          width: 16, height: 10,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(255,255,255,0.25) 0%, transparent 100%)',
          transform: 'rotate(30deg)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* Burst flash — expanding ring during tier transitions */}
      {burst && (
        <div style={{
          position: 'absolute',
          width: 350, height: 350,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${c.main}99 0%, ${c.main}44 30%, transparent 60%)`,
          animation: 'poOrbBurstFlash 0.2s ease-out forwards',
          pointerEvents: 'none',
        }} />
      )}
    </div>
  )
}

/* ─── Card Glow — rendered OUTSIDE tilt wrapper, does NOT tilt ─── */
function CardGlow({ card }) {
  if (!card) return null
  const r = RARITY_COLORS[card.rarity] || RARITY_COLORS.common
  const rank = RARITY_RANK[card.rarity] || 0

  return (
    <div style={{
      position: 'absolute', inset: -120,
      borderRadius: 80,
      background: `radial-gradient(ellipse at center, ${r.border}35 0%, ${r.border}12 30%, transparent 65%)`,
      animation: rank >= 2 ? 'poGlowPulse 2s ease-in-out infinite' : 'none',
      pointerEvents: 'none',
      zIndex: 0,
    }} />
  )
}

/* ─── Particle FX — rendered at OVERLAY level, pure flat 2D ─── */
/* memo + useMemo: particle random data is generated ONCE and never changes on re-renders */
const ParticlesFX = memo(function ParticlesFX({ card }) {
  const particles = useMemo(() => {
    if (!card) return null
    const r = RARITY_COLORS[card.rarity] || RARITY_COLORS.common
    const fx = RARITY_FX[card.rarity] || RARITY_FX.common
    const isRainbow = card.rarity === 'rainbow'
    if (fx.particles <= 0) return null
    return Array.from({ length: fx.particles }, (_, i) => {
      const angle = (i / fx.particles) * 360 + (Math.random() * 30 - 15)
      const dist = fx.dist * (0.3 + Math.random() * 0.9)
      const dx = Math.cos(angle * Math.PI / 180) * dist
      const dy = Math.sin(angle * Math.PI / 180) * dist
      const size = fx.pSize * (0.5 + Math.random() * 0.8)
      const color = isRainbow
        ? ['#EC4899', '#F59E0B', '#22C55E', '#3B82F6', '#8B5CF6'][i % 5]
        : r.border
      const duration = 1.0 + Math.random() * 1.5
      const delay = Math.random() * 0.3
      return { dx, dy, size, color, duration, delay }
    })
  }, [card])

  if (!particles) return null

  return (
    <div style={{
      position: 'absolute',
      left: '50%', top: '50%',
      width: 0, height: 0,
      pointerEvents: 'none',
      zIndex: 10,
      transform: 'none',
    }}>
      {particles.map((p, i) => (
        <div key={i} style={{
          position: 'absolute',
          left: 0, top: 0,
          width: p.size, height: p.size,
          borderRadius: '50%',
          background: p.color,
          boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
          '--dx': `${p.dx}px`,
          '--dy': `${p.dy}px`,
          animation: `poSparkle ${p.duration}s ease-out ${p.delay}s forwards`,
          pointerEvents: 'none',
        }} />
      ))}
    </div>
  )
})

/* ─── Card Reveal — uses unified ScaledCard renderer ─── */
function CardReveal({ entry, card, copiesPerRarity, isNew, tiltX = 0, tiltY = 0 }) {
  if (!entry || !card) return null
  const fx = RARITY_FX[card.rarity] || RARITY_FX.common
  const totalCopies = copiesPerRarity?.[card.rarity] || '?'
  const digits = String(totalCopies).length
  const copyStr = entry.copy != null ? String(entry.copy).padStart(digits, '0') : null

  return (
    <div style={{ position: 'relative' }}>
      <ScaledCard
        card={card}
        owned={true}
        copyInfo={copyStr}
        totalCopies={totalCopies}
        style={{ boxShadow: fx.glow }}
        tiltX={tiltX}
        tiltY={tiltY}
      />
      {isNew && (
        <div style={{
          position: 'absolute', top: 14, right: -8, zIndex: 20,
          transform: 'rotate(15deg)',
          background: 'linear-gradient(135deg, #FF6B6B, #FF2D55)',
          color: '#fff',
          fontSize: 13, fontWeight: 900, letterSpacing: 1,
          padding: '4px 16px',
          borderRadius: 4,
          boxShadow: '0 0 12px rgba(255,45,85,0.7), 0 0 24px rgba(255,45,85,0.4)',
          textShadow: '0 1px 3px rgba(0,0,0,0.4)',
          animation: 'newBadgePulse 1.5s ease-in-out infinite',
          pointerEvents: 'none',
        }}>
          NEW!
        </div>
      )}
    </div>
  )
}
