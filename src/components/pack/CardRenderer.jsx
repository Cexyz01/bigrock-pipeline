import { useRef, useEffect, useState } from 'react'
import { IconCards } from '../ui/Icons'
import { cld } from '../../lib/cld'
import { RARITY_COLORS, CARD_W, CARD_H, DEPTH_LAYERS } from '../../lib/cardConstants'
import { observeWidth } from '../../lib/sharedResizeObserver'
import bigrockLogo from '../../../Images/bigrock.png'

// Soft ambient shadows (solid edges are real divs)
const CARD_SHADOW_SOFT = 'inset 0 1px 0 rgba(255,255,255,0.07), 5px 9px 8px rgba(0,0,0,0.28), 7px 13px 20px rgba(0,0,0,0.14)'
const CARD_SHADOW_SOFT_DARK = 'inset 0 1px 0 rgba(255,255,255,0.04), 5px 9px 8px rgba(0,0,0,0.35), 7px 13px 20px rgba(0,0,0,0.18)'
const CARD_SHADOW_SOFT_ANIM = '5px 9px 8px rgba(0,0,0,0.28), 7px 13px 20px rgba(0,0,0,0.14)'

const DEFAULT_DEPTH_COLORS = ['#222', '#333', '#444']

// Dim a hex color toward black: factor 1 = original, 0 = black
function dimHex(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`
}

function CardBackFace({ w, h, border = 3, tiltX = 0, tiltY = 0, isStatic = false, borderColor = null }) {
  if (isStatic) {
    // Simple fixed depth for fan cards — no tilt, single layer
    const sH = border + 2
    const sV = border + 1
    return (
      <div style={{
        position: 'absolute',
        top: -sV, bottom: -sV, left: -sH, right: -sH,
        borderRadius: 16 + sH,
        background: borderColor ? dimHex(borderColor, 0.75) : '#333',
        zIndex: -1,
        pointerEvents: 'none',
      }} />
    )
  }

  // Dynamic depth for main card — 3 layers that fan out with tilt
  const dxFull = -tiltY * 0.08
  const dyFull = tiltX * 0.05
  const VISIBLE_H = 2
  const VISIBLE_V = 1
  const REST_H = border + VISIBLE_H
  const REST_V = border + VISIBLE_V
  const outerR = 16 + REST_H

  return DEPTH_LAYERS.map((layer, i) => {
    const t = layer.depth
    const color = borderColor ? dimHex(borderColor, layer.factor) : DEFAULT_DEPTH_COLORS[i]
    return (
      <div key={i} style={{
        position: 'absolute',
        top: -REST_V, bottom: -REST_V, left: -REST_H, right: -REST_H,
        borderRadius: outerR,
        background: color,
        transform: `translate(${dxFull * t}px, ${dyFull * t}px)`,
        zIndex: -1 - i,
        pointerEvents: 'none',
      }} />
    )
  })
}

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

// Pick Cloudinary bucket size that matches the rendered card.
// Doubles up for retina, snaps to discrete sizes for cache friendliness.
function pickBucket(displayW) {
  const target = Math.max(1, (displayW || CARD_W)) * (typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1.5)
  const buckets = [320, 480, 640, 800, 1024, 1280]
  for (const b of buckets) if (target <= b) return b
  return 1280
}

/**
 * CardRenderer — renders a card at canonical 300×420.
 * This is the SINGLE SOURCE OF TRUTH for how a card looks.
 * Use ScaledCard to display at any size.
 */
export default function CardRenderer({ card, owned = true, copyInfo, totalCopies, tiltX = 0, tiltY = 0, staticDepth = false, displayW = CARD_W }) {
  const r = RARITY_COLORS[card.rarity] || RARITY_COLORS.common
  const num = String(card.number).padStart(3, '0')

  // ── Unowned: card back with logo + number + pool bookmark ──
  if (!owned) {
    const POOL_COLORS = { red: '#EF4444', green: '#22C55E', blue: '#3B82F6' }
    const poolColor = POOL_COLORS[card.pack_type] || '#555'
    return (
      <div style={{
        width: CARD_W, height: CARD_H,
        position: 'relative',
        borderRadius: 16,
        overflow: 'visible',
        isolation: 'isolate',
        border: '3px solid #2a2a2a',
        background: '#181818',
        textAlign: 'left',
        boxShadow: CARD_SHADOW_SOFT_DARK,
      }}>
        {/* Back face — depth illusion */}
        <CardBackFace w={CARD_W} h={CARD_H} tiltX={tiltX} tiltY={tiltY} isStatic={staticDepth} />
        {/* Pool bookmark — top left, small */}
        <div style={{
          position: 'absolute', top: 0, left: 14, zIndex: 2,
          width: 12, height: 18,
          background: poolColor,
          borderRadius: '0 0 2px 2px',
          opacity: 0.5,
        }} />
        <div style={{
          position: 'relative', zIndex: 1, height: '100%',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          borderRadius: 13, overflow: 'hidden',
        }}>
          {/* BigRock logo — centered */}
          <img src={bigrockLogo} alt="" style={{
            width: 100, height: 'auto',
            opacity: 0.12,
            pointerEvents: 'none',
            userSelect: 'none',
            filter: 'invert(1)',
          }} />
        </div>
      </div>
    )
  }

  // ── Owned: full card render ──
  const isRainbow = card.rarity === 'rainbow'
  const isDiamond = card.rarity === 'diamond'
  const hasAnimBorder = isRainbow || isDiamond
  const isFullArt = isRainbow || isDiamond

  return (
    <div style={{
      width: CARD_W, height: CARD_H,
      position: 'relative',
      borderRadius: 16,
      overflow: 'visible',
      isolation: 'isolate',
      border: hasAnimBorder ? '3px solid transparent' : `3px solid ${r.border}`,
      background: '#222222',
      textAlign: 'left',
      boxShadow: hasAnimBorder ? 'none' : CARD_SHADOW_SOFT,
    }}>
      {/* Back face — depth illusion, colored for non-animated borders */}
      <CardBackFace w={CARD_W} h={CARD_H} tiltX={tiltX} tiltY={tiltY} isStatic={staticDepth} borderColor={hasAnimBorder ? null : r.border} />

      {/* Rainbow animated border */}
      {isRainbow && (
        <div className="cr-rainbow" style={{
          position: 'absolute', inset: -3, borderRadius: 19, padding: 3,
          background: 'linear-gradient(var(--rainbow-angle, 0deg), #EC4899, #F59E0B, #22C55E, #3B82F6, #8B5CF6, #EC4899)',
          zIndex: 0,
          boxShadow: CARD_SHADOW_SOFT_ANIM,
        }}>
          <div style={{ borderRadius: 16, width: '100%', height: '100%', background: '#222222' }} />
        </div>
      )}

      {/* Diamond animated border */}
      {isDiamond && (
        <div className="cr-diamond" style={{
          position: 'absolute', inset: -3, borderRadius: 19, padding: 3,
          background: 'conic-gradient(from var(--diamond-angle, 0deg), #06B6D4, #A5F3FC, #FFFFFF, #06B6D4, #164E63, #A5F3FC, #FFFFFF, #06B6D4)',
          zIndex: 0,
          boxShadow: CARD_SHADOW_SOFT_ANIM,
        }}>
          <div style={{ borderRadius: 16, width: '100%', height: '100%', background: '#222222' }} />
        </div>
      )}

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 1, height: '100%',
        display: 'flex', flexDirection: 'column',
        borderRadius: 13, overflow: 'hidden',
      }}>
        {/* Image area — FullArt fills entire card, Normal takes 55% */}
        <div style={{
          flex: isFullArt ? 1 : '0 0 55%',
          background: card.image_url ? undefined : `linear-gradient(135deg, ${r.bg}, #222222)`,
          backgroundImage: card.image_url ? `url(${cld(card.image_url, { w: pickBucket(displayW), h: pickBucket(displayW), fit: 'limit' })})` : undefined,
          backgroundPosition: card.image_url && card.image_position
            ? `${card.image_position.x}% ${card.image_position.y}%` : 'center',
          backgroundSize: card.image_url && card.image_position
            ? `${card.image_position.scale}%` : 'cover',
          backgroundRepeat: 'no-repeat',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
        }}>
          {!card.image_url && (
            <div style={{ opacity: 0.25 }}><IconCards size={48} color="#94A3B8" /></div>
          )}
          {/* Rarity strip — hidden on FullArt */}
          {!isFullArt && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
              background: `linear-gradient(90deg, transparent, ${r.border}, transparent)`,
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
          background: '#222222',
        }}>
          <div>
            <div style={{
              fontSize: 22, fontWeight: 700,
              color: '#F1F5F9',
              lineHeight: 1.2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              textShadow: isFullArt ? '0 1px 6px rgba(0,0,0,0.8)' : 'none',
            }}>
              {cleanName(card.name)}
            </div>
            <div style={{
              fontSize: 14, color: '#CBD5E1',
              lineHeight: 1.4, marginTop: 4,
              overflow: 'hidden',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              textShadow: isFullArt ? '0 1px 4px rgba(0,0,0,0.7)' : 'none',
            }}>
              {card.description}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 }}>
            <div>
              <div style={{
                fontSize: 14, fontWeight: 700,
                color: r.border,
                textTransform: 'uppercase', letterSpacing: '0.5px',
                textShadow: isFullArt ? '0 1px 4px rgba(0,0,0,0.7)' : 'none',
              }}>
                {r.label}
              </div>
              {copyInfo && (
                <div style={{ fontSize: 13, fontWeight: 600, color: '#94A3B8', fontFamily: 'monospace', marginTop: 2 }}>
                  #{copyInfo}{totalCopies ? '/' + totalCopies : ''}
                </div>
              )}
            </div>
            <span style={{
              fontSize: 21, fontWeight: 800,
              color: '#F1F5F9',
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
export function ScaledCard({ card, owned, copyInfo, totalCopies, width: fixedWidth, style, tiltX = 0, tiltY = 0, staticDepth = false }) {
  const ref = useRef(null)
  const [measuredWidth, setMeasuredWidth] = useState(fixedWidth || 0)

  useEffect(() => {
    if (fixedWidth) return
    const el = ref.current
    if (!el) return
    setMeasuredWidth(el.clientWidth)
    return observeWidth(el, (w) => { if (w) setMeasuredWidth(w) })
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
          <CardRenderer card={card} owned={owned} copyInfo={copyInfo} totalCopies={totalCopies} tiltX={tiltX} tiltY={tiltY} staticDepth={staticDepth} displayW={displayW} />
        </div>
      )}
    </div>
  )
}

export { RARITY_COLORS, CARD_W, CARD_H }
