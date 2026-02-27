import { useState, useEffect, useRef } from 'react'
import { PACK_TYPES, PACK_TIMER_MINUTES, PACK_MAX_ACCUMULATED } from '../../lib/constants'

export default function PackShop({ remaining, timer, onOpenPack, isAdmin, onResetPacks, canOpenPacks }) {
  const [hovered, setHovered] = useState(null)
  const [settling, setSettling] = useState(null)
  const [pressed, setPressed] = useState(null)
  const [countdown, setCountdown] = useState('')
  const [availablePacks, setAvailablePacks] = useState(timer?.available_packs || 0)
  const packRefs = useRef({})

  useEffect(() => {
    if (!timer) { setAvailablePacks(0); setCountdown(''); return }
    const calc = () => {
      const lastPack = new Date(timer.last_pack_at).getTime()
      const elapsed = Date.now() - lastPack
      const earned = Math.floor(elapsed / (PACK_TIMER_MINUTES * 60 * 1000))
      const total = Math.min(PACK_MAX_ACCUMULATED, (timer.available_packs || 0) + earned)
      setAvailablePacks(total)
      if (total < PACK_MAX_ACCUMULATED) {
        const nextAt = lastPack + ((earned + 1) * PACK_TIMER_MINUTES * 60 * 1000)
        const diff = Math.max(0, nextAt - Date.now())
        const m = Math.floor(diff / 60000)
        const s = Math.floor((diff % 60000) / 1000)
        setCountdown(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      } else {
        setCountdown('MAX')
      }
    }
    calc()
    const iv = setInterval(calc, 1000)
    return () => clearInterval(iv)
  }, [timer])

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Shop title */}
      <h2 style={{ fontSize: 18, fontWeight: 800, color: '#F1F5F9', margin: '0 0 24px', textAlign: 'center' }}>Shop</h2>

      {/* 3 packs — horizontal, free-floating */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        gap: 12,
        padding: '0 4px',
      }}>
        {PACK_TYPES.map((pack, packIdx) => {
          const isH = hovered === pack.id
          const isSettling = settling === pack.id
          const isP = pressed === pack.id
          const rem = remaining?.[pack.id] ?? '—'
          const canOpen = canOpenPacks && availablePacks > 0 && (remaining?.[pack.id] ?? 0) > 0

          return (
            <div
              key={pack.id}
              onMouseEnter={() => { setHovered(pack.id); setSettling(s => s === pack.id ? null : s) }}
              onMouseLeave={() => { if (hovered === pack.id) setSettling(pack.id); setHovered(null) }}
              onClick={() => {
                if (!canOpen) return
                setPressed(pack.id)
                const el = packRefs.current[pack.id]
                const rect = el ? el.getBoundingClientRect() : null
                setTimeout(() => { setPressed(null); onOpenPack(pack.id, rect) }, 150)
              }}
              style={{
                flex: '1 1 0',
                maxWidth: 180,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                cursor: canOpen ? 'pointer' : 'default',
              }}
            >
              {/* Pack image — float wrapper (always) + tilt wrapper (hover/settle) */}
              <div
                ref={el => { packRefs.current[pack.id] = el }}
                style={{
                  width: '100%',
                  position: 'relative',
                  animation: 'packIdle 5s ease-in-out infinite',
                  animationDelay: `${packIdx * -1.7}s`,
                }}
              >
                <div
                  style={{
                    transformOrigin: 'center center',
                    transition: 'filter 0.4s ease',
                    filter: availablePacks <= 0
                      ? 'grayscale(1) brightness(0.45)'
                      : isH
                        ? `saturate(1.3) brightness(1.15) drop-shadow(0 0 24px ${pack.color}60)`
                        : 'saturate(0.5) brightness(0.65)',
                    animation: isH
                      ? 'packPendulumEntry 0.2s ease-out forwards, packPendulum 0.8s ease-in-out 0.2s infinite'
                      : isSettling
                        ? 'packSettle 0.6s ease-out forwards'
                        : 'none',
                  }}
                  onAnimationEnd={(e) => {
                    if (e.animationName === 'packSettle') setSettling(null)
                  }}
                >
                  <img
                    src={pack.image}
                    alt={`Pack ${pack.label}`}
                    draggable={false}
                    style={{
                      width: '100%', display: 'block', borderRadius: 8,
                      transition: 'transform 0.15s ease',
                      transform: isP ? 'scale(0.9)' : 'scale(1)',
                    }}
                  />
                </div>
              </div>

              {/* Label — title image */}
              <div style={{
                marginTop: 8,
                lineHeight: 1,
                transition: 'all 0.3s ease',
                filter: isH ? `brightness(1.2) drop-shadow(0 0 16px ${pack.color}70)` : 'brightness(0.7) saturate(0.5)',
              }}>
                <img
                  src={pack.titleImage}
                  alt={pack.label}
                  draggable={false}
                  style={{ height: 28, display: 'block', margin: '0 auto' }}
                />
              </div>

              {/* Remaining count */}
              <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 4 }}>
                {typeof rem === 'number' ? rem.toLocaleString() : rem} remaining
              </div>
            </div>
          )
        })}
      </div>

      {/* Packs Available — segmented bar + timer */}
      <div style={{ marginTop: 28, padding: '0 12px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Packs Available
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: availablePacks > 0 ? '#22C55E' : '#64748B' }}>
            {availablePacks}/{PACK_MAX_ACCUMULATED}
          </span>
        </div>

        {/* Segmented progress bar — 3 sections */}
        <div style={{
          display: 'flex', gap: 3, height: 8, borderRadius: 5, overflow: 'hidden',
          width: '60%', margin: '0 auto',
        }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              flex: 1,
              borderRadius: i === 0 ? '4px 0 0 4px' : i === 2 ? '0 4px 4px 0' : 0,
              background: i < availablePacks
                ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                : '#2d2d2d',
              border: i < availablePacks ? 'none' : '1px solid #3a3a3a',
              transition: 'all 0.4s ease',
              boxShadow: i < availablePacks ? '0 0 8px rgba(34,197,94,0.3)' : 'none',
            }} />
          ))}
        </div>

        {/* Timer row */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 10,
        }}>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            {countdown === 'MAX'
              ? <span style={{ color: '#22C55E', fontWeight: 600 }}>Max reached</span>
              : <>Next pack in <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#F59E0B' }}>{countdown || '--:--'}</span></>
            }
          </div>

          {/* Admin reset button — only visible to admins */}
          {isAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); onResetPacks() }}
              style={{
                padding: '4px 12px', borderRadius: 8,
                border: '1px solid #F28C2840', background: 'transparent',
                color: '#F5B862', fontSize: 10, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.target.style.background = '#F28C2820'; e.target.style.borderColor = '#F28C28' }}
              onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.borderColor = '#F28C2840' }}
            >
              ↻ Reset Pack
            </button>
          )}
        </div>

        {availablePacks > 0 && (
          <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 12, fontWeight: 600, textAlign: 'center', animation: 'pulseHint 2s ease-in-out infinite' }}>
            ↑ Click a pack to open it ↑
          </div>
        )}
      </div>

      {/* CSS */}
      <style>{`
        @font-face {
          font-family: 'Heartbreaker';
          src: url('/fonts/Heartbreaker.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        @font-face {
          font-family: 'Cafe24PROUP';
          src: url('/fonts/Cafe24PROUP.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        @keyframes packPendulumEntry {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(7deg); }
        }
        @keyframes packPendulum {
          0%   { transform: rotate(7deg); }
          50%  { transform: rotate(-7deg); }
          100% { transform: rotate(7deg); }
        }
        @keyframes packIdle {
          0%, 100% { transform: translateY(0px); }
          50%      { transform: translateY(-8px); }
        }
        @keyframes packSettle {
          0%   { transform: rotate(2deg); }
          40%  { transform: rotate(-1deg); }
          70%  { transform: rotate(0.3deg); }
          100% { transform: rotate(0deg); }
        }
        @keyframes pulseHint {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
