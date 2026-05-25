import { TCG_THEME } from '../../lib/cardConstants'

const D = TCG_THEME

// Milestones expressed as fractions of the total (so we get sensible
// markers whatever the collection size becomes).
const MILESTONE_FRACTIONS = [0.25, 0.5, 0.75, 1]

export default function CollectionHeader({ ownedCount, totalCount, isMobile, rarityCounts }) {
  const pct = totalCount ? (ownedCount / totalCount) * 100 : 0
  const pctLabel = Math.round(pct)

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: isMobile ? 10 : 18,
        flex: 1, minWidth: 0,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <img
          src="/images/title_image_tcg.png"
          alt="BigRock TCG"
          draggable={false}
          style={{ height: isMobile ? 28 : 36, display: 'block' }}
        />
        <p style={{
          fontSize: isMobile ? 10 : 11,
          color: D.muted,
          margin: '4px 0 0',
          letterSpacing: '0.3px',
        }}>
          <strong style={{ color: D.text, fontWeight: 700 }}>{ownedCount}</strong>
          <span style={{ opacity: 0.6 }}> / {totalCount}</span>
          <span style={{ marginLeft: 6, opacity: 0.7 }}>cards collected</span>
        </p>
      </div>

      {!isMobile && (
        <div style={{ flex: 1, minWidth: 0, maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Progress bar with milestone markers */}
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalCount || 0}
            aria-valuenow={ownedCount}
            aria-label="Collezione completata"
            style={{
              position: 'relative',
              height: 10,
              borderRadius: 6,
              background: D.border,
              overflow: 'visible',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
            }}
          >
            <div style={{
              width: `${pct}%`,
              height: '100%',
              borderRadius: 6,
              background: 'linear-gradient(90deg, #F28C28 0%, #F5B862 60%, #FDE68A 100%)',
              boxShadow: '0 0 12px rgba(245,184,98,0.5)',
              transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)',
            }} />
            {/* Tier markers — small notches at quartiles */}
            {MILESTONE_FRACTIONS.map((f, i) => (
              <span key={i} style={{
                position: 'absolute',
                left: `${f * 100}%`,
                top: -2, bottom: -2,
                width: 2,
                marginLeft: -1,
                background: pct >= f * 100 ? 'rgba(253,230,138,0.9)' : 'rgba(255,255,255,0.18)',
                borderRadius: 1,
                pointerEvents: 'none',
              }} />
            ))}
            {/* Percentage label, anchored at fill edge */}
            <span style={{
              position: 'absolute',
              right: 0, top: -22,
              fontSize: 12, fontWeight: 800,
              color: '#F5B862',
              fontFamily: 'monospace',
              letterSpacing: '0.5px',
            }}>
              {pctLabel}%
            </span>
          </div>

          {/* Rarity badges row */}
          {rarityCounts && (
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              {rarityCounts.map(r => (
                <span
                  key={r.id}
                  title={`${r.owned}/${r.total} ${r.label}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 7px',
                    borderRadius: 10,
                    background: r.owned ? `${r.color}22` : 'transparent',
                    border: `1px solid ${r.owned ? r.color + '55' : D.border}`,
                    fontSize: 10, fontWeight: 700,
                    color: r.owned ? r.color : D.dim,
                    fontFamily: 'monospace',
                  }}
                >
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: r.color,
                    opacity: r.owned ? 1 : 0.35,
                  }} />
                  {r.owned}/{r.total}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {isMobile && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalCount || 0}
          aria-valuenow={ownedCount}
          style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}
        >
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: D.border, overflow: 'hidden', minWidth: 60 }}>
            <div style={{
              width: `${pct}%`,
              height: '100%', borderRadius: 3,
              background: 'linear-gradient(90deg, #F28C28, #F5B862)',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#F5B862' }}>{pctLabel}%</span>
        </div>
      )}
    </div>
  )
}
