import { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  getPackCards, getUserCards, getUserTimer, upsertUserTimer,
  getPacksRemaining, claimAndOpenPack, getPackConfig, subscribeToTable, supabase,
} from '../../lib/supabase'
import { hasPermission, PACK_TYPES, PACK_RARITIES } from '../../lib/constants'
import { RARITY_COLORS, TCG_THEME, PACK_WINDOW_START_MIN, PACK_WINDOW_END_MIN, PACK_WINDOW_LABEL } from '../../lib/cardConstants'
import { ScaledCard } from '../pack/CardRenderer'
import PackShop from '../pack/PackShop'
import PackAdminPanel from '../pack/PackAdminPanel'
import PackOpening from '../pack/PackOpening'
import CollectionHeader from '../pack/CollectionHeader'
import CollectionFilters from '../pack/CollectionFilters'
import CollectionGrid from '../pack/CollectionGrid'
import FloatingCard from '../pack/FloatingCard'
import Fade from '../ui/Fade'
import useIsMobile from '../../hooks/useIsMobile'
import useTilt3D from '../../hooks/useTilt3D'

const D = TCG_THEME

const TABS = [
  { id: 'collection', label: 'Collection' },
  { id: 'admin', label: 'Admin', adminOnly: true },
]

export default function PackPage({ user, addToast, requestConfirm, tcgGameActive, onGameStateChange }) {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState('collection')
  const [cards, setCards] = useState([])
  const [userCards, setUserCards] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters / search
  const [rarityFilter, setRarityFilter] = useState('all')
  const [poolFilter, setPoolFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [ownedOnly, setOwnedOnly] = useState(false)

  // Admin-only: preview the full collection as if every card were owned
  const [showFullCollection, setShowFullCollection] = useState(false)

  // Detail modal
  const [selected, setSelected] = useState(null)
  const [selectedOwned, setSelectedOwned] = useState(false)

  const [timer, setTimer] = useState(null)
  const [remaining, setRemaining] = useState({ red: 0, green: 0, blue: 0 })
  const [copiesPerRarity, setCopiesPerRarity] = useState({})

  // Pack opening
  const [openingPack, setOpeningPack] = useState(null)
  const [openingPackType, setOpeningPackType] = useState(null)
  const [flyRect, setFlyRect] = useState(null)
  const [preOpenOwned, setPreOpenOwned] = useState(null)

  // Free-table floating cards (in-memory only — reset on reload)
  const [floats, setFloats] = useState([])
  const floatZRef = (typeof window !== 'undefined') ? (window.__bigrockFloatZ ||= { v: 8500 }) : { v: 8500 }

  const liftedMap = useMemo(() => {
    const m = {}
    for (const f of floats) m[f.cardNumber] = (m[f.cardNumber] || 0) + 1
    return m
  }, [floats])

  const handleLift = useCallback((info) => {
    const uid = 'f_' + Math.random().toString(36).slice(2, 10)
    floatZRef.v += 1
    setFloats(prev => [
      ...prev,
      {
        uid,
        cardNumber: info.card.number,
        card: info.card,
        x: info.x,
        y: info.y,
        width: info.width,
        copyInfo: info.copyInfo,
        totalCopies: info.totalCopies,
        z: floatZRef.v,
      },
    ])
    return uid
  }, [floatZRef])

  const handleFloatMove = useCallback((uid, x, y) => {
    setFloats(prev => prev.map(f => f.uid === uid ? { ...f, x, y } : f))
  }, [])

  const handleFloatPickup = useCallback((uid) => {
    floatZRef.v += 1
    const z = floatZRef.v
    setFloats(prev => prev.map(f => f.uid === uid ? { ...f, z } : f))
  }, [floatZRef])

  const handleFloatReturn = useCallback((uid) => {
    setFloats(prev => prev.filter(f => f.uid !== uid))
  }, [])

  const handleFloatClick = useCallback((f) => {
    const card = cards.find(c => c.number === f.cardNumber) || f.card
    setSelected(card)
    setSelectedOwned(true)
  }, [cards])

  // "New" badge tracking
  const SEEN_KEY = `tcg_seen_${user.id}`
  const [seenCards, setSeenCards] = useState(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY)
      if (raw) return new Set(JSON.parse(raw))
    } catch {}
    return null
  })

  const markCardSeen = useCallback((cardNumber) => {
    setSeenCards(prev => {
      if (!prev || prev.has(cardNumber)) return prev
      const next = new Set(prev)
      next.add(cardNumber)
      try { localStorage.setItem(SEEN_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
  }, [SEEN_KEY])

  useEffect(() => { loadAll() }, [user])

  // Realtime auto-refresh
  useEffect(() => {
    let timeout
    const channel = subscribeToTable('pack_user_cards', () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        getUserCards(user.id).then(uc => setUserCards(uc))
      }, 500)
    })
    return () => {
      clearTimeout(timeout)
      supabase.removeChannel(channel)
    }
  }, [user.id])

  const loadAll = async () => {
    const [c, uc, t, rem, cfg] = await Promise.all([
      getPackCards(),
      getUserCards(user.id),
      getUserTimer(user.id),
      getPacksRemaining(),
      getPackConfig(),
    ])
    setCards(c)
    setUserCards(uc)
    setRemaining(rem)
    if (cfg?.copies_per_rarity) setCopiesPerRarity(cfg.copies_per_rarity)

    if (!t) {
      const { data: newTimer } = await upsertUserTimer(user.id, {
        available_packs: 3,
        last_pack_at: new Date().toISOString(),
      })
      setTimer(newTimer)
    } else {
      setTimer(t)
    }

    setLoading(false)

    setSeenCards(prev => {
      if (prev !== null) return prev
      const seed = new Set(uc.map(u => u.card_number))
      try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seed])) } catch {}
      return seed
    })
  }

  const admin = hasPermission(user, 'manage_tcg')

  const ownedSet = useMemo(() => new Set(userCards.map(uc => uc.card_number)), [userCards])

  // Admin-only preview: show every card as owned without touching real ownership data.
  const effectiveOwnedSet = useMemo(() => {
    if (!admin || !showFullCollection) return ownedSet
    return new Set(cards.map(c => c.number))
  }, [admin, showFullCollection, cards, ownedSet])

  const copiesMap = useMemo(() => {
    const m = {}
    for (const uc of userCards) {
      if (!m[uc.card_number]) m[uc.card_number] = []
      m[uc.card_number].push({ copy_number: uc.copy_number, obtained_at: uc.obtained_at, id: uc.id })
    }
    for (const key of Object.keys(m)) {
      m[key].sort((a, b) => new Date(a.obtained_at) - new Date(b.obtained_at))
    }
    return m
  }, [userCards])

  const copyCountMap = useMemo(() => {
    const m = {}
    for (const [cardNum, copies] of Object.entries(copiesMap)) m[cardNum] = copies.length
    return m
  }, [copiesMap])

  const copyInfoMap = useMemo(() => {
    const m = {}
    for (const [cardNum, copies] of Object.entries(copiesMap)) {
      if (copies.length > 0 && copies[0].copy_number != null) {
        const card = cards.find(c => String(c.number) === String(cardNum))
        const total = copiesPerRarity?.[card?.rarity]
        const digits = total ? String(total).length : 2
        m[cardNum] = String(copies[0].copy_number).padStart(digits, '0')
      }
    }
    return m
  }, [copiesMap, cards, copiesPerRarity])

  // Pool-scoped cards (used by both the grid and the filter chip counters)
  const cardsForPool = useMemo(() => {
    if (poolFilter === 'all') return cards
    return cards.filter(c => c.pack_type === poolFilter)
  }, [cards, poolFilter])

  const cardsAfterRarity = useMemo(() => {
    if (rarityFilter === 'all') return cardsForPool
    return cardsForPool.filter(c => c.rarity === rarityFilter)
  }, [cardsForPool, rarityFilter])

  const poolCounts = useMemo(() => {
    const m = {}
    for (const p of PACK_TYPES) m[p.id] = cards.filter(c => c.pack_type === p.id).length
    return m
  }, [cards])

  const rarityCounts = useMemo(() => {
    return PACK_RARITIES.map(r => {
      const ownedDistinct = cards.filter(c => c.rarity === r.id && effectiveOwnedSet.has(c.number)).length
      return { id: r.id, label: r.label, color: r.color, owned: ownedDistinct, total: r.total }
    })
  }, [cards, effectiveOwnedSet])

  const ownedCount = effectiveOwnedSet.size
  const totalCount = cards.length

  const handleCardClick = (card, owned) => {
    if (!owned) return
    setSelected(card)
    setSelectedOwned(owned)
  }

  const resetFilters = useCallback(() => {
    setRarityFilter('all'); setPoolFilter('all'); setSearch(''); setOwnedOnly(false)
  }, [])

  const isInPackTimeWindow = () => {
    const now = new Date()
    const m = now.getHours() * 60 + now.getMinutes()
    return m >= PACK_WINDOW_START_MIN && m < PACK_WINDOW_END_MIN
  }
  const canOpenPacks = tcgGameActive ? (!admin && isInPackTimeWindow()) : admin

  const handleOpenPack = async (packType, rect) => {
    if (!canOpenPacks) {
      if (tcgGameActive && admin) {
        addToast('Admins cannot open packs during active game', 'error')
      } else if (tcgGameActive && !admin && !isInPackTimeWindow()) {
        addToast(`Puoi aprire i pacchetti solo dalle ${PACK_WINDOW_LABEL}`, 'error')
      } else {
        addToast('You cannot open packs right now', 'error')
      }
      return
    }
    setPreOpenOwned(new Set(ownedSet))
    setOpeningPackType(packType)
    setFlyRect(rect)

    const { data, error } = await claimAndOpenPack(user.id, packType)
    if (error) {
      setOpeningPackType(null)
      setFlyRect(null)
      addToast(error.message || 'Error opening pack', 'error')
      return
    }
    setOpeningPack({ ...data, pack_type: packType })
  }

  const handleOpeningClose = () => {
    setOpeningPack(null)
    setOpeningPackType(null)
    setFlyRect(null)
    loadAll()
  }

  const handleResetPacks = async () => {
    await upsertUserTimer(user.id, {
      available_packs: 3,
      last_pack_at: new Date().toISOString(),
    })
    addToast('Packs reset to 3/3', 'success')
    loadAll()
  }

  const visibleTabs = TABS.filter(t => !t.adminOnly || admin)

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: D.muted, fontSize: 14, background: D.bg,
        userSelect: 'none', WebkitUserSelect: 'none',
      }}>
        Loading cards...
      </div>
    )
  }

  return (
    <>
    <Fade style={{ height: '100%' }}>
      <div style={{
        background: D.bg,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}>
        {/* Top bar */}
        <div style={{
          padding: isMobile ? '12px 16px' : '14px 28px',
          borderBottom: `1px solid ${D.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: isMobile ? 8 : 16,
          flexShrink: 0,
        }}>
          <CollectionHeader
            ownedCount={ownedCount}
            totalCount={totalCount}
            isMobile={isMobile}
            rarityCounts={rarityCounts}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {admin && (
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                padding: '6px 12px', borderRadius: 8, background: D.card, border: `1px solid ${D.border}`,
                fontSize: 12, fontWeight: 600, color: showFullCollection ? '#F5B862' : D.muted, userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={showFullCollection}
                  onChange={(e) => setShowFullCollection(e.target.checked)}
                  style={{ accentColor: '#F28C28', width: 14, height: 14, cursor: 'pointer' }}
                />
                Mostra collezione completa
              </label>
            )}

            {visibleTabs.length > 1 && (
            <div
              role="tablist"
              aria-label="Sezione TCG"
              style={{ display: 'flex', gap: 3, background: D.card, borderRadius: 10, padding: 2, border: `1px solid ${D.border}` }}
            >
              {visibleTabs.map(t => {
                const active = tab === t.id
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(t.id)}
                    style={{
                      padding: '6px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s',
                      background: active ? '#F28C28' : 'transparent',
                      color: active ? '#fff' : D.muted,
                      outline: 'none',
                    }}
                    onFocus={(e) => { if (!active) e.currentTarget.style.boxShadow = '0 0 0 3px rgba(242,140,40,0.25)' }}
                    onBlur={(e) => { e.currentTarget.style.boxShadow = 'none' }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>
          )}
          </div>
        </div>

        {/* Main content */}
        {tab === 'collection' && (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, minHeight: 0, ...(isMobile ? { overflowY: 'auto', WebkitOverflowScrolling: 'touch' } : {}) }}>
            {/* LEFT/TOP: Shop */}
            <div style={{
              ...(isMobile ? {
                padding: '12px 16px 8px',
                borderBottom: `1px solid ${D.border}`,
                flexShrink: 0,
              } : {
                width: '36%',
                minWidth: 420,
                maxWidth: 560,
                borderRight: `1px solid ${D.border}`,
                padding: '24px 28px',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                flexShrink: 0,
              }),
            }}>
              <PackShop
                remaining={remaining}
                timer={timer}
                onOpenPack={handleOpenPack}
                isAdmin={admin}
                onResetPacks={handleResetPacks}
                canOpenPacks={canOpenPacks}
                requestConfirm={requestConfirm}
              />
            </div>

            {/* RIGHT/BOTTOM: Collection */}
            <div style={{
              flex: isMobile ? 'none' : 1,
              display: 'flex', flexDirection: 'column',
              minWidth: 0,
              ...(isMobile ? {} : { minHeight: 0 }),
            }}>
              <div style={{
                padding: isMobile ? '12px 12px 0' : '18px 24px 6px',
                flexShrink: 0,
              }}>
                <CollectionFilters
                  poolFilter={poolFilter} setPoolFilter={setPoolFilter}
                  rarityFilter={rarityFilter} setRarityFilter={setRarityFilter}
                  search={search} setSearch={setSearch}
                  ownedOnly={ownedOnly} setOwnedOnly={setOwnedOnly}
                  poolCounts={poolCounts}
                  isMobile={isMobile}
                />
              </div>

              <div style={{
                ...(isMobile ? {} : { flex: 1, minHeight: 0, overflowY: 'auto' }),
                padding: isMobile ? '8px 12px 68px' : '12px 24px 24px',
              }}>
                <CollectionGrid
                  cards={cardsAfterRarity}
                  ownedSet={effectiveOwnedSet}
                  seenCards={showFullCollection ? effectiveOwnedSet : seenCards}
                  onCardClick={handleCardClick}
                  onCardSeen={markCardSeen}
                  copyInfoMap={copyInfoMap}
                  copyCountMap={copyCountMap}
                  copiesPerRarity={copiesPerRarity}
                  search={search}
                  ownedOnly={ownedOnly}
                  isMobile={isMobile}
                  onResetFilters={resetFilters}
                  liftedMap={liftedMap}
                  onLift={handleLift}
                  onLiftMove={handleFloatMove}
                />
              </div>
            </div>
          </div>
        )}

        {tab === 'admin' && admin && (
          <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1 }}>
            <PackAdminPanel addToast={addToast} requestConfirm={requestConfirm} tcgGameActive={tcgGameActive} onGameStateChange={onGameStateChange} />
          </div>
        )}

        <style>{`
          @keyframes modalIn {
            from { opacity: 0; transform: scale(0.95); }
            to   { opacity: 1; transform: scale(1); }
          }
          button:active {
            transform: scale(0.95);
            transition: transform 0.08s ease;
          }
        `}</style>
      </div>
    </Fade>

    {/* Detail Modal */}
    {selected && createPortal(
      <DetailModal
        card={selected}
        owned={selectedOwned}
        copies={copiesMap[selected.number]?.length ? copiesMap[selected.number] : (showFullCollection ? [{ copy_number: null, obtained_at: null, id: 'preview' }] : [])}
        cards={cards}
        copiesPerRarity={copiesPerRarity}
        isMobile={isMobile}
        onClose={() => setSelected(null)}
      />,
      document.body
    )}

    {/* Free-table: floating cards (in-memory, reset on reload) */}
    {floats.length > 0 && createPortal(
      <>
        {floats.map(f => (
          <FloatingCard
            key={f.uid}
            float={f}
            onMove={handleFloatMove}
            onPickup={handleFloatPickup}
            onClick={handleFloatClick}
            onReturn={handleFloatReturn}
          />
        ))}
      </>,
      document.body
    )}

    {/* Pack Opening overlay */}
    {(openingPackType || openingPack) && createPortal(
      <PackOpening
        pack={openingPack}
        cards={cards}
        packType={openingPackType || openingPack?.pack_type}
        onClose={handleOpeningClose}
        copiesPerRarity={copiesPerRarity}
        flyRect={flyRect}
        preOpenOwned={preOpenOwned}
      />,
      document.body
    )}


  </>
  )
}

function DetailModal({ card, owned, copies, cards, copiesPerRarity, isMobile, onClose }) {
  const { tiltRef, shineRef, handlers, setTilt } = useTilt3D({ onTap: onClose })

  return (
    <div
      onClick={() => { setTilt(0, 0, true); onClose() }}
      onMouseMove={handlers.onMouseMove}
      onMouseLeave={handlers.onMouseLeave}
      onTouchStart={handlers.onTouchStart}
      onTouchMove={handlers.onTouchMove}
      onTouchEnd={handlers.onTouchEnd}
      onTouchCancel={handlers.onTouchCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        userSelect: 'none', WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        padding: 28, animation: 'modalIn 0.2s ease',
      }}>
        <CardDetail
          card={card} owned={owned}
          rarity={RARITY_COLORS[card.rarity]}
          copies={copies}
          cards={cards}
          copiesPerRarity={copiesPerRarity}
          tiltRef={tiltRef}
          shineRef={shineRef}
          isMobile={isMobile}
        />
      </div>
    </div>
  )
}

function CardDetail({ card, owned, rarity, copies, cards, copiesPerRarity, tiltRef, shineRef, isMobile }) {
  const pt = PACK_TYPES.find(p => p.id === card.pack_type)
  const totalCopies = copiesPerRarity?.[card.rarity] || '?'

  const MAX_TOTAL_DEG = 18
  const BASE_ANGLE = 6
  const n = copies.length - 1
  const FAN_ANGLE = n <= 3 ? -BASE_ANGLE : -(MAX_TOTAL_DEG / n)

  return (
    <div style={{ textAlign: 'center' }}>
      <div
        ref={tiltRef}
        style={{
          transform: 'perspective(800px) rotateX(0deg) rotateY(0deg)',
          transition: 'transform 0.18s ease-out',
          transformStyle: 'preserve-3d',
        }}
      >
        <div style={{
          position: 'relative', width: isMobile ? '50vw' : 360, margin: '0 auto 20px',
          aspectRatio: '2.5 / 3.5',
        }}>
          {copies.map((copy, i) => {
            const digits = String(totalCopies).length
            const copyStr = copy.copy_number != null ? String(copy.copy_number).padStart(digits, '0') : null
            return (
              <div key={copy.id || i} style={{
                position: i === 0 ? 'relative' : 'absolute',
                top: 0, left: 0, width: '100%',
                transform: i === 0 ? 'none' : `rotateZ(${i * FAN_ANGLE}deg)`,
                transformOrigin: 'bottom left',
                zIndex: copies.length - i,
                filter: i === 0 ? 'none' : `brightness(${Math.max(0.55, 1 - i * 0.12)})`,
                transition: 'transform 0.3s ease',
              }}>
                <ScaledCard
                  card={card} owned={true}
                  copyInfo={copyStr}
                  totalCopies={totalCopies}
                  staticDepth={i > 0}
                />
              </div>
            )
          })}
          {copies.length > 0 && (
            <div ref={shineRef} style={{
              position: 'absolute', inset: 0,
              borderRadius: Math.round(16 * (isMobile ? window.innerWidth * 0.5 : 360) / 300),
              pointerEvents: 'none',
              zIndex: copies.length + 2,
              opacity: 0,
            }} />
          )}
        </div>
      </div>

      {pt && (
        <div style={{ marginBottom: 8 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 12,
            background: `${pt.color}20`, color: pt.color, fontSize: 11, fontWeight: 700,
          }}>
            Pool {pt.label}
          </div>
        </div>
      )}

      <div>
        {owned ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
            background: 'rgba(16,185,129,0.15)', color: '#10B981', fontSize: 12, fontWeight: 600,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Owned{copies.length > 1 ? ` (${copies.length} copies)` : ''}
          </div>
        ) : (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
            background: '#2d2d2d', color: '#94A3B8', fontSize: 12, fontWeight: 600,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
            Not owned
          </div>
        )}
      </div>
    </div>
  )
}
