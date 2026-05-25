import { useMemo } from 'react'
import PackCard from './PackCard'
import {
  GRID_CARD_MIN_DESKTOP, GRID_CARD_MIN_MOBILE,
  GRID_GAP_DESKTOP, GRID_GAP_MOBILE,
  TCG_THEME,
} from '../../lib/cardConstants'

const D = TCG_THEME

// Inject stagger CSS once
if (typeof document !== 'undefined' && !document.getElementById('coll-grid-css')) {
  const s = document.createElement('style')
  s.id = 'coll-grid-css'
  s.textContent = `
    @keyframes collFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .coll-cell {
      animation: collFadeIn 0.32s cubic-bezier(0.22,1,0.36,1) backwards;
    }
  `
  document.head.appendChild(s)
}

export default function CollectionGrid({
  cards, ownedSet, seenCards, onCardClick, onCardSeen,
  copyInfoMap, copyCountMap, copiesPerRarity,
  search, ownedOnly,
  isMobile, onResetFilters,
}) {
  const visible = useMemo(() => {
    let list = cards
    if (ownedOnly) list = list.filter(c => ownedSet.has(c.number))
    if (search) {
      const q = search.trim().toLowerCase()
      if (q) {
        const numQ = q.replace(/^#/, '')
        list = list.filter(c => {
          const num = String(c.number).padStart(3, '0')
          return (
            (c.name || '').toLowerCase().includes(q) ||
            num.includes(numQ) ||
            String(c.number) === numQ
          )
        })
      }
    }
    return [...list].sort((a, b) => a.number - b.number)
  }, [cards, ownedSet, search, ownedOnly])

  if (visible.length === 0) {
    return <EmptyState ownedOnly={ownedOnly} search={search} onReset={onResetFilters} />
  }

  return (
    <ul
      role="list"
      style={{
        listStyle: 'none', padding: 0, margin: 0,
        display: 'grid',
        gridTemplateColumns: isMobile
          ? `repeat(auto-fill, minmax(${GRID_CARD_MIN_MOBILE}px, 1fr))`
          : `repeat(auto-fill, minmax(${GRID_CARD_MIN_DESKTOP}px, 1fr))`,
        gap: isMobile ? GRID_GAP_MOBILE : GRID_GAP_DESKTOP,
      }}
    >
      {visible.map((card, i) => {
        const owned = ownedSet.has(card.number)
        const isNew = owned && seenCards && !seenCards.has(card.number)
        return (
          <li
            key={card.number}
            className="coll-cell"
            style={{ animationDelay: `${Math.min(i * 18, 600)}ms` }}
          >
            <PackCard
              card={card}
              owned={owned}
              isNew={isNew}
              onSeen={onCardSeen}
              onClick={onCardClick}
              copyInfo={copyInfoMap[card.number]}
              totalCopies={copiesPerRarity?.[card.rarity]}
              copyCount={copyCountMap[card.number] || 0}
            />
          </li>
        )
      })}
    </ul>
  )
}

function EmptyState({ ownedOnly, search, onReset }) {
  const filtered = ownedOnly || (search && search.trim())
  return (
    <div style={{
      textAlign: 'center', padding: '60px 24px',
      color: D.muted, fontSize: 14,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: D.card, border: `1px solid ${D.border}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: D.dim,
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <path d="M3 10h18" />
        </svg>
      </div>
      <div style={{ fontWeight: 700, color: D.sub }}>
        {filtered ? 'Nessuna carta corrisponde ai filtri' : 'Ancora nessuna carta in questa categoria'}
      </div>
      {filtered && onReset && (
        <button
          type="button"
          onClick={onReset}
          style={{
            padding: '6px 14px', borderRadius: 10,
            background: 'transparent', border: `1px solid #F28C28`, color: '#F5B862',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >Pulisci filtri</button>
      )}
    </div>
  )
}
