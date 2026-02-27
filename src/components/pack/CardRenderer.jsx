import { useRef, useEffect, useState } from 'react'

// ── Rarity visual config ──
const RARITY_COLORS = {
  common:  { border: '#64748B', glow: 'rgba(100,116,139,0.3)', label: 'Common',  bg: '#1E2530' },
  rare:    { border: '#22C55E', glow: 'rgba(34,197,94,0.35)',  label: 'Rare',    bg: '#14532D' },
  gold:    { border: '#F59E0B', glow: 'rgba(245,158,11,0.35)', label: 'Gold',    bg: '#422006' },
  diamond: { border: '#06B6D4', glow: 'rgba(6,182,212,0.35)',  label: 'Diamond', bg: '#083344' },
  rainbow: { border: '#EC4899', glow: 'rgba(236,72,153,0.4)',  label: 'Rainbow', bg: '#500724' },
}

// Canonical render size — card is always rendered at this size, then CSS-scaled
const CARD_W = 300
const CARD_H = 420

function cleanName(name) {
  return (name || '').replace(/\s*#\d+$/, '')
}

// ── Inject global keyframe styles once ──
if (typeof document !== 'undefined' && !document.getElementById('card-renderer-css')) {
  const s = document.createElement('style')
  s.id = 'card-renderer-css'
  s.textContent = `
    @property --rainbow-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
    @property --diamond-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
    .cr-rainbow { animation: crRainbow 3s linear infinite; }
    .cr-diamond { animation: crDiamond 4s linear infinite; }
    @keyframes crRainbow { to { --rainbow-angle: 360deg; } }
    @keyframes crDiamond { to { --diamond-angle: 360deg; } }
  `
  document.head.appendChild(s)
}

/**
 * CardRenderer — renders a card at canonical 300×420.
 * This is the SINGLE SOURCE OF TRUTH for how a card looks.
 * Use ScaledCard to display at any size.
 */
export default function CardRenderer({ card, owned = true, copyInfo, totalCopies }) {
  const r = RARITY_COLORS[card.rarity] || RARITY_COLORS.common
  const num = String(card.number).padStart(3, '0')
  const isRainbow = card.rarity === 'rainbow'
  const isDiamond = card.rarity === 'diamond'
  const hasAnimBorder = isRainbow || isDiamond
  const isFullArt = isRainbow || isDiamond
  const borderColor = owned ? r.border : `${r.border}60`

  return (
    <div style={{
      width: CARD_W, height: CARD_H,
      position: 'relative',
      borderRadius: 16,
      overflow: hasAnimBorder ? 'visible' : 'hidden',
      border: hasAnimBorder ? '3px solid transparent' : `3px solid ${borderColor}`,
      background: owned ? '#141820' : '#0F1218',
      textAlign: 'left',
    }}>
      {/* Rainbow animated border */}
      {isRainbow && (
        <div className="cr-rainbow" style={{
          position: 'absolute', inset: -3, borderRadius: 19, padding: 3,
          background: 'linear-gradient(var(--rainbow-angle, 0deg), #EC4899, #F59E0B, #22C55E, #3B82F6, #8B5CF6, #EC4899)',
          zIndex: 0, opacity: owned ? 1 : 0.5,
        }}>
          <div style={{ borderRadius: 16, width: '100%', height: '100%', background: owned ? '#141820' : '#0F1218' }} />
        </div>
      )}

      {/* Diamond animated border */}
      {isDiamond && (
        <div className="cr-diamond" style={{
          position: 'absolute', inset: -3, borderRadius: 19, padding: 3,
          background: 'conic-gradient(from var(--diamond-angle, 0deg), #06B6D4, #A5F3FC, #FFFFFF, #06B6D4, #164E63, #A5F3FC, #FFFFFF, #06B6D4)',
          zIndex: 0, opacity: owned ? 1 : 0.5,
        }}>
          <div style={{ borderRadius: 16, width: '100%', height: '100%', background: owned ? '#141820' : '#0F1218' }} />
        </div>
      )}

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column',
        borderRadius: hasAnimBorder ? 13 : 0, overflow: 'hidden',
      }}>
        {/* Image area — FullArt fills entire card, Normal takes 55% */}
        <div style={{
          flex: isFullArt ? 1 : '0 0 55%',
          background: owned
            ? (card.image_url ? undefined : `linear-gradient(135deg, ${r.bg}, #141820)`)
            : '#0F1218',
          backgroundImage: owned && card.image_url ? `url(${card.image_url})` : undefined,
          backgroundPosition: owned && card.image_url && card.image_position
            ? `${card.image_position.x}% ${card.image_position.y}%` : 'center',
          backgroundSize: owned && card.image_url && card.image_position
            ? `${card.image_position.scale}%` : 'cover',
          backgroundRepeat: 'no-repeat',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          {!owned && (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={r.border}
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35 }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01" />
            </svg>
          )}
          {owned && !card.image_url && (
            <div style={{ fontSize: 48, opacity: 0.25 }}>🃏</div>
          )}
          {/* Rarity strip — hidden on FullArt */}
          {!isFullArt && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
              background: `linear-gradient(90deg, transparent, ${r.border}, transparent)`,
              opacity: owned ? 1 : 0.5,
            }} />
          )}
        </div>

        {/* Info section — FullArt: overlay at 55%; Normal: flex bottom */}
        <div style={isFullArt ? {
          position: 'absolute', top: '55%', bottom: 0, left: 0, right: 0, zIndex: 2,
          padding: '14px 18px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          background: 'linear-gradient(to top, rgba(10,12,18,0.92) 40%, rgba(10,12,18,0.6) 75%, transparent)',
          borderRadius: hasAnimBorder ? '0 0 13px 13px' : 0,
        } : {
          flex: 1, padding: '14px 18px',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          background: owned ? '#141820' : '#0F1218',
        }}>
          <div>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: owned ? '#F1F5F9' : '#64748B',
              lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textShadow: isFullArt ? '0 1px 6px rgba(0,0,0,0.8)' : 'none',
            }}>
              {owned ? cleanName(card.name) : '???'}
            </div>
            <div style={{
              fontSize: 12, color: owned ? '#CBD5E1' : '#64748B',
              lineHeight: 1.4, marginTop: 4,
              overflow: 'hidden',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              textShadow: isFullArt ? '0 1px 4px rgba(0,0,0,0.7)' : 'none',
            }}>
              {owned ? card.description : 'Carta sconosciuta'}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
            <div>
              <div style={{
                fontSize: 12, fontWeight: 700,
                color: owned ? r.border : `${r.border}80`,
                textTransform: 'uppercase', letterSpacing: '0.5px',
                textShadow: isFullArt ? '0 1px 4px rgba(0,0,0,0.7)' : 'none',
              }}>
                {r.label}
              </div>
              {owned && copyInfo && (
                <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', fontFamily: 'monospace', marginTop: 2 }}>
                  #{copyInfo}{totalCopies ? '/' + totalCopies : ''}
                </div>
              )}
            </div>
            <span style={{
              fontSize: 18, fontWeight: 800,
              color: owned ? '#F1F5F9' : '#475569',
              fontFamily: 'monospace',
              textShadow: isFullArt ? '0 1px 6px rgba(0,0,0,0.8)' : 'none',
            }}>
              {num}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * ScaledCard — wraps CardRenderer and CSS-scales it to fit any container.
 * Pass `width` for a known size, or let it auto-measure via ResizeObserver.
 */
export function ScaledCard({ card, owned, copyInfo, totalCopies, width: fixedWidth, style }) {
  const ref = useRef(null)
  const [measuredWidth, setMeasuredWidth] = useState(fixedWidth || 0)

  useEffect(() => {
    if (fixedWidth) return
    const el = ref.current
    if (!el) return
    // Initial measure
    setMeasuredWidth(el.clientWidth)
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setMeasuredWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [fixedWidth])

  const displayW = fixedWidth || measuredWidth
  const scale = displayW / CARD_W

  return (
    <div
      ref={fixedWidth ? undefined : ref}
      style={{
        width: fixedWidth || '100%',
        aspectRatio: '2.5 / 3.5',
        position: 'relative',
        overflow: 'visible',
        borderRadius: 16 * scale || 0,
        ...style,
      }}
    >
      {scale > 0 && (
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: CARD_W,
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
        }}>
          <CardRenderer card={card} owned={owned} copyInfo={copyInfo} totalCopies={totalCopies} />
        </div>
      )}
    </div>
  )
}

export { RARITY_COLORS, CARD_W, CARD_H }
