import { useState, useEffect, useRef } from 'react'
import { PACK_TYPES, PACK_MAX_ACCUMULATED } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'

const fmtRome = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })

export default function PackShop({ remaining, timer, onOpenPack, isAdmin, onResetPacks, canOpenPacks, requestConfirm }) {
  const isMobile = useIsMobile()
  const [hovered, setHovered] = useState(null)
  const [settling, setSettling] = useState(null)
  const [pressed, setPressed] = useState(null)
  const [countdown, setCountdown] = useState('')
  const availablePacks = timer?.available_packs || 0
  const packRefs = useRef({})

  // Anchor the on-screen countdown to the server clock (timer.server_now) at fetch time,
  // then tick it forward using performance.now() — a monotonic clock the OS wall-clock
  // can't rewind — so changing the device's date/time can't fake a faster reset.
  useEffect(() => {
    if (!timer?.next_reset_at || !timer?.server_now) { setCountdown(''); return }
    const nextAt = new Date(timer.next_reset_at).getTime()
    const serverAtFetch = new Date(timer.server_now).getTime()
    const perfAtFetch = performance.now()
    const calc = () => {
      const serverNow = serverAtFetch + (performance.now() - perfAtFetch)
      const diff = Math.max(0, nextAt - serverNow)
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
    }
    calc()
    const iv = setInterval(calc, 1000)
    return () => clearInterval(iv)
  }, [timer])

  const nextResetLabel = timer?.next_reset_at ? fmtRome.format(new Date(timer.next_reset_at)) : '--:--'

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
              onPointerEnter={(e) => { if (isMobile || e.pointerType === 'touch') return; setHovered(pack.id); setSettling(s => s === pack.id ? null : s) }}
              onPointerLeave={(e) => { if (isMobile || e.pointerType === 'touch') return; if (hovered === pack.id) setSettling(pack.id); setHovered(null) }}
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
                        : isMobile
                          ? 'saturate(1) brightness(1)'
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
                filter: isH ? `brightness(1.2) drop-shadow(0 0 16px ${pack.color}70)` : isMobile ? 'brightness(1) saturate(1)' : 'brightness(0.7) saturate(0.5)',
              }}>
                <img
                  src={pack.titleImage}
                  alt={pack.label}
                  draggable={false}
                  style={{ height: 28, display: 'block', margin: '0 auto' }}
                />
              </div>

              {/* Remaining count — pill */}
              <div style={{
                marginTop: 6,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '2px 9px',
                borderRadius: 999,
                background: `${pack.color}1a`,
                border: `1px solid ${pack.color}33`,
                fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
                color: '#E2E8F0',
                fontFamily: 'monospace',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: pack.color }} />
                {typeof rem === 'number' ? rem.toLocaleString() : rem}
                <span style={{ opacity: 0.6 }}>left</span>
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
          <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
            {availablePacks > 0
              ? <>Prossimo reset alle <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#E2E8F0' }}>{nextResetLabel}</span></>
              : <>Prossimo reset tra <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: '#F59E0B' }}>{countdown || '--:--:--'}</span> (ore {nextResetLabel})</>
            }
          </div>

          {/* Admin reset button — only visible to admins */}
          {isAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (requestConfirm) {
                  requestConfirm('Riportare i pacchetti disponibili a 3/3?', () => onResetPacks())
                } else {
                  onResetPacks()
                }
              }}
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
