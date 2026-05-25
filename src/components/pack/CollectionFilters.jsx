import { PACK_TYPES } from '../../lib/constants'
import { RARITY_COLORS, TCG_THEME } from '../../lib/cardConstants'

const D = TCG_THEME

const RARITIES = ['all', 'common', 'rare', 'gold', 'diamond', 'rainbow']
const RARITY_LABELS = { all: 'All', common: 'Common', rare: 'Rare', gold: 'Gold', diamond: 'Diamond', rainbow: 'Rainbow' }

const SORT_OPTIONS = [
  { id: 'number', label: 'Numero' },
  { id: 'rarity', label: 'Rarità' },
  { id: 'name',   label: 'Nome' },
  { id: 'new',    label: 'Novità' },
]

export default function CollectionFilters({
  poolFilter, setPoolFilter,
  rarityFilter, setRarityFilter,
  sort, setSort,
  search, setSearch,
  ownedOnly, setOwnedOnly,
  poolCounts,
  isMobile,
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Row 1: Search + Owned toggle + Sort */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      }}>
        <label style={{
          position: 'relative', flex: '1 1 220px', minWidth: 160, maxWidth: 360,
        }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: D.dim, pointerEvents: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o #numero"
            aria-label="Cerca carte"
            style={{
              width: '100%',
              padding: '7px 10px 7px 30px',
              borderRadius: 10,
              background: D.card,
              border: `1px solid ${D.border}`,
              color: D.text,
              fontSize: 12,
              outline: 'none',
              transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            }}
            onFocus={(e) => { e.target.style.borderColor = '#F28C28'; e.target.style.boxShadow = '0 0 0 3px rgba(242,140,40,0.15)' }}
            onBlur={(e) => { e.target.style.borderColor = D.border; e.target.style.boxShadow = 'none' }}
          />
        </label>

        <button
          type="button"
          onClick={() => setOwnedOnly(v => !v)}
          aria-pressed={ownedOnly}
          style={{
            padding: '6px 12px', borderRadius: 10, cursor: 'pointer',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.3px',
            border: `1px solid ${ownedOnly ? '#22C55E' : D.border}`,
            background: ownedOnly ? 'rgba(34,197,94,0.15)' : D.card,
            color: ownedOnly ? '#22C55E' : D.sub,
            transition: 'all 0.15s ease',
          }}
        >
          {ownedOnly ? '✓ Solo possedute' : 'Solo possedute'}
        </button>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px', borderRadius: 10,
          background: D.card, border: `1px solid ${D.border}`,
        }} role="radiogroup" aria-label="Ordinamento">
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={sort === opt.id}
              onClick={() => setSort(opt.id)}
              style={{
                padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                fontSize: 10, fontWeight: 700, letterSpacing: '0.3px',
                background: sort === opt.id ? '#F28C28' : 'transparent',
                color: sort === opt.id ? '#fff' : D.muted,
                transition: 'all 0.15s ease',
              }}
            >{opt.label}</button>
          ))}
        </div>
      </div>

      {/* Row 2: Pool chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Filtro Pool">
        <span style={{ fontSize: 10, fontWeight: 700, color: D.sub, marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pool</span>
        {['all', ...PACK_TYPES.map(p => p.id)].map(p => {
          const pt = PACK_TYPES.find(t => t.id === p)
          const active = poolFilter === p
          const count = p === 'all'
            ? Object.values(poolCounts || {}).reduce((a, b) => a + b, 0)
            : (poolCounts?.[p] || 0)
          return (
            <button
              key={p}
              type="button"
              aria-pressed={active}
              onClick={() => setPoolFilter(p)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px 4px 8px',
                borderRadius: 999,
                fontSize: 11, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s ease',
                background: active ? (pt ? pt.color : '#F28C28') : D.card,
                color: active ? '#fff' : D.sub,
                border: `1px solid ${active ? 'transparent' : D.border}`,
                outline: 'none',
              }}
              onFocus={(e) => { if (!active) e.target.style.boxShadow = '0 0 0 3px rgba(242,140,40,0.25)' }}
              onBlur={(e) => { e.target.style.boxShadow = 'none' }}
            >
              {pt && (
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: pt.color,
                  boxShadow: active ? '0 0 0 2px rgba(255,255,255,0.6)' : 'none',
                }} />
              )}
              {p === 'all' ? 'All' : pt?.label}
              <span style={{
                fontFamily: 'monospace', fontWeight: 800, fontSize: 10,
                padding: '1px 5px', borderRadius: 6,
                background: active ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.05)',
                color: active ? '#fff' : D.muted,
              }}>{count}</span>
            </button>
          )
        })}
      </div>

      {/* Row 3: Rarity chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }} role="group" aria-label="Filtro Rarità">
        <span style={{ fontSize: 10, fontWeight: 700, color: D.sub, marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rarity</span>
        {RARITIES.map(r => {
          const active = rarityFilter === r
          const col = RARITY_COLORS[r]?.border || '#F28C28'
          return (
            <button
              key={r}
              type="button"
              aria-pressed={active}
              onClick={() => setRarityFilter(r)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '4px 12px', borderRadius: 999,
                fontSize: 11, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s ease',
                background: active ? col : D.card,
                color: active ? '#fff' : D.sub,
                border: `1px solid ${active ? 'transparent' : D.border}`,
                outline: 'none',
              }}
              onFocus={(e) => { if (!active) e.target.style.boxShadow = '0 0 0 3px rgba(242,140,40,0.25)' }}
              onBlur={(e) => { e.target.style.boxShadow = 'none' }}
            >
              {r !== 'all' && (
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: col,
                  boxShadow: active ? '0 0 0 2px rgba(255,255,255,0.6)' : 'none',
                }} />
              )}
              {RARITY_LABELS[r]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
