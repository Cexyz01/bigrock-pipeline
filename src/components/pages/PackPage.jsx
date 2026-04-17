import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getPackCards, getUserCards, grantCard as grantCardApi, getUserTimer, upsertUserTimer, getPacksRemaining, claimAndOpenPack, getPackConfig, subscribeToTable, supabase } from '../../lib/supabase'
import { hasPermission, PACK_TYPES, PACK_RARITIES } from '../../lib/constants'
import PackCard, { RARITY_COLORS } from '../pack/PackCard'
import { ScaledCard } from '../pack/CardRenderer'
import PackShop from '../pack/PackShop'
import PackAdminPanel from '../pack/PackAdminPanel'
import PackOpening from '../pack/PackOpening'
import PackTrading from '../pack/PackTrading'
import { IconX } from '../ui/Icons'
import Fade from '../ui/Fade'
import useIsMobile from '../../hooks/useIsMobile'

const D = {
  bg: '#1a1a1a',
  card: '#222222',
  border: '#2d2d2d',
  text: '#F1F5F9',
  sub: '#CBD5E1',
  muted: '#94A3B8',
  dim: '#64748B',
}

const RARITIES = ['all', 'common', 'rare', 'gold', 'diamond', 'rainbow']
const RARITY_LABELS = { all: 'All', common: 'Common', rare: 'Rare', gold: 'Gold', diamond: 'Diamond', rainbow: 'Rainbow' }
const POOL_FILTER = ['all', ...PACK_TYPES.map(p => p.id)]

const TABS = [
  { id: 'collection', label: 'Collection' },
  { id: 'admin', label: 'Admin', adminOnly: true },
]

export default function PackPage({ user, profiles, addToast, requestConfirm, tcgGameActive, onGameStateChange, onTradeInviteSent }) {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState('collection')
  const [shopTab, setShopTab] = useState('shop') // mobile only: 'shop' | 'trading'
  const [cards, setCards] = useState([])
  const [userCards, setUserCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [rarityFilter, setRarityFilter] = useState('all')
  const [poolFilter, setPoolFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [selectedOwned, setSelectedOwned] = useState(false)
  const detailTiltRef = useRef(null)
  const detailShineRef = useRef(null)
  const detailTouchRef = useRef(null)

  // Direct DOM tilt — avoids React re-renders for 60fps smoothness
  const setTiltDirect = useCallback((tx, ty, animate) => {
    const el = detailTiltRef.current
    if (!el) return
    el.style.transition = animate ? 'transform 0.18s ease-out' : 'none'
    el.style.transform = `perspective(800px) rotateX(${tx}deg) rotateY(${ty}deg)`
    // Light reflection — diagonal band that sweeps across the card with tilt
    const shine = detailShineRef.current
    if (shine) {
      const mag = Math.sqrt(tx * tx + ty * ty)
      const intensity = Math.min(mag / 15, 1)
      shine.style.transition = animate ? 'opacity 0.18s ease-out' : 'none'
      shine.style.opacity = intensity > 0.01 ? '1' : '0'
      if (intensity > 0.01) {
        // Light reflects opposite to tilt: tilt down (tx>0) → light moves up, tilt up (tx<0) → light moves down
        // Diagonal band (~135°) with slight rotation from horizontal tilt
        const a = 135 + ty * 0.5
        const p = 50 + tx * 5
        const pk = (0.15 * intensity).toFixed(3)
        const lo = (0.04 * intensity).toFixed(3)
        shine.style.background = `linear-gradient(${a}deg, transparent ${p - 40}%, rgba(255,255,255,${lo}) ${p - 20}%, rgba(255,255,255,${pk}) ${p}%, rgba(255,255,255,${lo}) ${p + 20}%, transparent ${p + 40}%)`
      }
    }
  }, [])

  const [timer, setTimer] = useState(null)
  const [remaining, setRemaining] = useState({ red: 0, green: 0, blue: 0 })
  const [copiesPerRarity, setCopiesPerRarity] = useState({})

  // Pack opening — optimistic render + fly transition
  const [openingPack, setOpeningPack] = useState(null) // { pack_type, cards: [...] } or null
  const [openingPackType, setOpeningPackType] = useState(null) // set immediately on click
  const [flyRect, setFlyRect] = useState(null) // bounding rect of clicked pack in shop
  const [preOpenOwned, setPreOpenOwned] = useState(null) // snapshot of ownedSet before pack open

  // Staff grant
  const [grantOpen, setGrantOpen] = useState(false)
  const [grantUser, setGrantUser] = useState('')
  const [grantNum, setGrantNum] = useState('')
  const [granting, setGranting] = useState(false)

  // "New" badge in collection — track which cards user has seen (hovered) at least once
  const SEEN_KEY = `tcg_seen_${user.id}`
  const [seenCards, setSeenCards] = useState(() => {
    try {
      const raw = localStorage.getItem(SEEN_KEY)
      if (raw) return new Set(JSON.parse(raw))
    } catch {}
    return null // null = not initialized yet, will seed on first load
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

  // Realtime: auto-refresh collection when cards change (e.g. admin reset)
  useEffect(() => {
    let timeout
    const channel = subscribeToTable('pack_user_cards', () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        getUserCards(user.id).then(uc => setUserCards(uc))
      }, 500) // debounce to avoid flood on mass delete
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

    // Auto-initialize timer if it doesn't exist (first visit)
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

    // Seed seenCards with all currently owned cards on first visit
    // so existing cards don't all show as "NEW"
    setSeenCards(prev => {
      if (prev !== null) return prev // already initialized from localStorage
      const seed = new Set(uc.map(u => u.card_number))
      try { localStorage.setItem(SEEN_KEY, JSON.stringify([...seed])) } catch {}
      return seed
    })
  }

  const ownedSet = useMemo(() => new Set(userCards.map(uc => uc.card_number)), [userCards])

  // Group all copies per card_number, sorted by obtained_at ASC (first copy first)
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

  // Display copy_number = first obtained copy (for grid display)
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

  const filteredCards = useMemo(() => {
    let filtered = cards
    if (poolFilter !== 'all') filtered = filtered.filter(c => c.pack_type === poolFilter)
    if (rarityFilter !== 'all') filtered = filtered.filter(c => c.rarity === rarityFilter)
    return filtered
  }, [cards, rarityFilter, poolFilter])

  const ownedCount = ownedSet.size
  const totalCount = cards.length

  const handleCardClick = (card, owned) => {
    if (!owned) return
    setSelected(card)
    setSelectedOwned(owned)
  }

  const handleOpenPack = async (packType, rect) => {
    if (!canOpenPacks) {
      if (tcgGameActive && admin) {
        addToast('Admins cannot open packs during active game', 'error')
      } else if (tcgGameActive && !admin && !isInPackTimeWindow()) {
        addToast('Puoi aprire i pacchetti solo dalle 9:30 alle 18:10', 'error')
      } else {
        addToast('You cannot open packs right now', 'error')
      }
      return
    }
    // Snapshot owned cards BEFORE opening (for "NEW" badge)
    setPreOpenOwned(new Set(ownedSet))
    // Optimistic render: show pack overlay immediately with fly animation
    setOpeningPackType(packType)
    setFlyRect(rect)

    // Start Supabase call in background
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
    loadAll() // Refresh collection
  }

  const handleResetPacks = async () => {
    await upsertUserTimer(user.id, {
      available_packs: 3,
      last_pack_at: new Date().toISOString(),
    })
    addToast('Packs reset to 3/3', 'success')
    loadAll()
  }

  const handleGrant = async () => {
    if (!grantUser || grantNum === '') return
    setGranting(true)
    const num = parseInt(grantNum, 10)
    const { error } = await grantCardApi(grantUser, num, 'staff_reward')
    if (error) {
      addToast(error.message?.includes('duplicate') ? 'User already has this card' : `Error: ${error.message}`, 'error')
    } else {
      addToast('Card assigned!', 'success')
      loadAll()
    }
    setGranting(false)
    setGrantOpen(false)
    setGrantUser('')
    setGrantNum('')
  }

  // Admin can't open packs when game is active (to avoid compromising the game)
  // Non-admin can only open between 9:30 and 18:10 during active game
  const admin = hasPermission(user, 'manage_tcg')
  const isInPackTimeWindow = () => {
    const now = new Date()
    const m = now.getHours() * 60 + now.getMinutes()
    return m >= 570 && m < 1090 // 9:30 = 570min, 18:10 = 1090min
  }
  const canOpenPacks = tcgGameActive ? (!admin && isInPackTimeWindow()) : admin

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
          gap: isMobile ? 8 : 12,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 20 }}>
            <div>
              <img src="/images/title_image_tcg.png" alt="BigRock TCG" draggable={false} style={{ height: isMobile ? 28 : 36, display: 'block' }} />
              <p style={{ fontSize: isMobile ? 10 : 12, color: D.sub, margin: '4px 0 0' }}>
                {ownedCount}/{totalCount} cards collected
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: isMobile ? 80 : 120, height: 6, borderRadius: 3, background: D.border, overflow: 'hidden' }}>
                <div style={{
                  width: `${totalCount ? (ownedCount / totalCount * 100) : 0}%`,
                  height: '100%', borderRadius: 3,
                  background: 'linear-gradient(90deg, #F28C28, #F5B862)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#F5B862' }}>
                {totalCount ? Math.round(ownedCount / totalCount * 100) : 0}%
              </span>
            </div>
          </div>

          {visibleTabs.length > 1 && (
            <div style={{ display: 'flex', gap: 3, background: D.card, borderRadius: 10, padding: 2, border: `1px solid ${D.border}` }}>
              {visibleTabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: '6px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s',
                    background: tab === t.id ? '#F28C28' : 'transparent',
                    color: tab === t.id ? '#fff' : D.muted,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Main content */}
        {tab === 'collection' && (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', flex: 1, minHeight: 0, ...(isMobile ? { overflowY: 'auto', WebkitOverflowScrolling: 'touch' } : {}) }}>
            {/* LEFT/TOP: Shop + Trading */}
            <div style={{
              ...(isMobile ? {
                padding: '12px 16px 8px',
                borderBottom: `1px solid ${D.border}`,
                flexShrink: 0,
              } : {
                width: '42%',
                minWidth: 500,
                maxWidth: 780,
                borderRight: `1px solid ${D.border}`,
                padding: '24px 32px',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',
                flexShrink: 0,
              }),
            }}>
              {/* Tab switcher Shop / Trading */}
              <div style={{
                display: 'flex', gap: 3, background: D.card, borderRadius: 10, padding: 2,
                border: `1px solid ${D.border}`, marginBottom: isMobile ? 12 : 20, alignSelf: 'center',
              }}>
                {[{ id: 'shop', label: 'Shop' }, { id: 'trading', label: 'Trading' }].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setShopTab(t.id)}
                    style={{
                      padding: '6px 20px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s',
                      background: shopTab === t.id ? '#F28C28' : 'transparent',
                      color: shopTab === t.id ? '#fff' : D.muted,
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Show only active sub-tab */}
              {shopTab === 'shop' && (
                <PackShop remaining={remaining} timer={timer} onOpenPack={handleOpenPack} isAdmin={admin} onResetPacks={handleResetPacks} canOpenPacks={canOpenPacks} />
              )}
              {shopTab === 'trading' && (
                <PackTrading
                  user={user}
                  profiles={profiles}
                  addToast={addToast}
                  onInviteSent={onTradeInviteSent}
                />
              )}
            </div>

            {/* RIGHT/BOTTOM: Collection */}
            <div style={{
              flex: isMobile ? 'none' : 1,
              display: 'flex', flexDirection: 'column',
              minWidth: 0,
              ...(isMobile ? {} : { minHeight: 0 }),
            }}>
              {/* Sticky filters */}
              <div style={{
                padding: isMobile ? '12px 12px 0' : '18px 24px 0',
                flexShrink: 0,
              }}>
                {/* Pool filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: D.sub, marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pool:</span>
                  {POOL_FILTER.map(p => {
                    const pt = PACK_TYPES.find(t => t.id === p)
                    return (
                      <button
                        key={p}
                        onClick={() => setPoolFilter(p)}
                        style={{
                          padding: '4px 12px', borderRadius: 14, fontSize: 11, fontWeight: 600,
                          cursor: 'pointer', transition: 'all 0.2s',
                          background: poolFilter === p ? (pt ? pt.color : '#F28C28') : D.card,
                          color: poolFilter === p ? '#fff' : D.sub,
                          border: `1px solid ${poolFilter === p ? 'transparent' : D.border}`,
                        }}
                      >
                        {p === 'all' ? 'All' : pt?.label}
                        {p !== 'all' && (
                          <span style={{ marginLeft: 3, opacity: 0.7 }}>({cards.filter(c => c.pack_type === p).length})</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Rarity filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: D.sub, marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rarity:</span>
                  {RARITIES.map(r => (
                    <button
                      key={r}
                      onClick={() => setRarityFilter(r)}
                      style={{
                        padding: '4px 12px', borderRadius: 14, fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', transition: 'all 0.2s',
                        background: rarityFilter === r ? (RARITY_COLORS[r]?.border || '#F28C28') : D.card,
                        color: rarityFilter === r ? '#fff' : D.sub,
                        border: `1px solid ${rarityFilter === r ? 'transparent' : D.border}`,
                      }}
                    >
                      {RARITY_LABELS[r]}
                    </button>
                  ))}

                  {admin && (
                    <button
                      onClick={() => setGrantOpen(true)}
                      style={{
                        marginLeft: 'auto', padding: '4px 14px', borderRadius: 14,
                        border: '1.5px solid #F28C2840', fontSize: 11, fontWeight: 600,
                        cursor: 'pointer', background: 'transparent', color: '#F5B862', transition: 'all 0.2s',
                      }}
                    >
                      + Assign card
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable card grid */}
              <div style={{
                ...(isMobile ? {} : { flex: 1, minHeight: 0, overflowY: 'auto' }),
                padding: isMobile ? '8px 12px 68px' : '12px 24px 24px',
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(90px, 1fr))' : 'repeat(auto-fill, minmax(210px, 1fr))',
                  gap: isMobile ? 8 : 12,
                }}>
                  {filteredCards.map(card => {
                    const owned = ownedSet.has(card.number)
                    const isNew = owned && seenCards && !seenCards.has(card.number)
                    return (
                      <PackCard
                        key={card.number}
                        card={card}
                        owned={owned}
                        isNew={isNew}
                        onSeen={markCardSeen}
                        onClick={handleCardClick}
                        copyInfo={copyInfoMap[card.number]}
                        totalCopies={copiesPerRarity?.[card.rarity]}
                        copyCount={copyCountMap[card.number] || 0}
                      />
                    )
                  })}
                </div>

                {filteredCards.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 60, color: D.muted, fontSize: 14 }}>
                    No cards in this category
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Admin tab — only for admins */}
        {tab === 'admin' && admin && (
          <div style={{ padding: '24px 32px', overflowY: 'auto', flex: 1 }}>
            <PackAdminPanel addToast={addToast} requestConfirm={requestConfirm} tcgGameActive={tcgGameActive} onGameStateChange={onGameStateChange} />
          </div>
        )}

        {/* Global styles */}
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

    {/* === Portals: rendered outside Fade so position:fixed works correctly === */}

    {/* Detail Modal — portal to body for true viewport centering */}
    {selected && createPortal(
      <div
        onClick={() => { setTiltDirect(0, 0, true); setSelected(null) }}
        onMouseMove={(e) => {
          const el = detailTiltRef.current
          if (!el) return
          const rect = el.getBoundingClientRect()
          const cx = rect.left + rect.width / 2
          const cy = rect.top + rect.height / 2
          const nx = (e.clientX - cx) / (rect.width / 2)
          const ny = (e.clientY - cy) / (rect.height / 2)
          const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
          setTiltDirect(clamp(ny * -15, -15, 15), clamp(nx * 15, -15, 15), true)
        }}
        onMouseLeave={() => setTiltDirect(0, 0, true)}
        onTouchStart={(e) => {
          const t = e.touches[0]
          detailTouchRef.current = { x: t.clientX, y: t.clientY, moved: false }
        }}
        onTouchMove={(e) => {
          if (!detailTouchRef.current) return
          const t = e.touches[0]
          const dx = t.clientX - detailTouchRef.current.x
          const dy = t.clientY - detailTouchRef.current.y
          if (Math.abs(dx) > 5 || Math.abs(dy) > 5) detailTouchRef.current.moved = true
          const clamp = (v, min, max) => Math.min(max, Math.max(min, v))
          setTiltDirect(clamp(dy * -0.12, -15, 15), clamp(dx * 0.12, -15, 15), false)
        }}
        onTouchEnd={(e) => {
          const wasTap = detailTouchRef.current && !detailTouchRef.current.moved
          detailTouchRef.current = null
          setTiltDirect(0, 0, true)
          if (wasTap) {
            e.preventDefault() // prevent ghost click from reaching cards behind the portal
            setSelected(null)
          }
        }}
        onTouchCancel={() => { detailTouchRef.current = null; setTiltDirect(0, 0, true) }}
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
          <CardDetail card={selected} owned={selectedOwned} rarity={RARITY_COLORS[selected.rarity]} copies={copiesMap[selected.number] || []} cards={cards} copiesPerRarity={copiesPerRarity} tiltRef={detailTiltRef} shineRef={detailShineRef} isMobile={isMobile} />
        </div>
      </div>,
      document.body
    )}

    {/* Grant Card Modal — portal to body */}
    {grantOpen && createPortal(
      <div
        onClick={() => setGrantOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        <div onClick={e => e.stopPropagation()} style={{
          background: D.card, border: `1px solid ${D.border}`, borderRadius: 20,
          padding: 28, width: '90%', maxWidth: 400,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          animation: 'modalIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: 0 }}>Assign card</h2>
            <button onClick={() => setGrantOpen(false)} style={{
              background: '#2d2d2d', border: 'none', color: D.muted, borderRadius: 8,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <IconX size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: D.sub, display: 'block', marginBottom: 4 }}>User</label>
              <select value={grantUser} onChange={e => setGrantUser(e.target.value)} style={{
                width: '100%', padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${D.border}`,
                fontSize: 13, background: D.bg, color: D.text, outline: 'none',
              }}>
                <option value="">Select user...</option>
                {(profiles || []).map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: D.sub, display: 'block', marginBottom: 4 }}>Card number (0-119)</label>
              <input type="number" min="0" max="119" value={grantNum} onChange={e => setGrantNum(e.target.value)} style={{
                width: '100%', padding: '8px 12px', borderRadius: 10, border: `1.5px solid ${D.border}`,
                fontSize: 13, background: D.bg, color: D.text, outline: 'none', boxSizing: 'border-box',
              }} placeholder="e.g. 42" />
            </div>
            <button onClick={handleGrant} disabled={granting || !grantUser || grantNum === ''} style={{
              padding: '10px 0', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
              cursor: granting ? 'wait' : 'pointer', background: '#F28C28', color: '#fff',
              opacity: (granting || !grantUser || grantNum === '') ? 0.5 : 1, transition: 'opacity 0.2s',
            }}>
              {granting ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    )}

    {/* Pack Opening overlay — portal to body (shows immediately on click for fly anim) */}
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

function CardDetail({ card, owned, rarity, copies, cards, copiesPerRarity, tiltRef, shineRef, isMobile }) {
  const pt = PACK_TYPES.find(p => p.id === card.pack_type)
  const totalCopies = copiesPerRarity?.[card.rarity] || '?'
  const hasMultiple = copies.length > 1

  // Fan config: negative angle = opens to the left, pivot = bottom-left
  // Max spread = 3 × 6° = 18° (equivalent to 4 cards). More copies → smaller angle per card.
  const MAX_TOTAL_DEG = 18
  const BASE_ANGLE = 6
  const n = copies.length - 1 // number of cards behind the front one
  const FAN_ANGLE = n <= 3 ? -BASE_ANGLE : -(MAX_TOTAL_DEG / n)

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Tilt wrapper — transform controlled via direct DOM manipulation for 60fps smoothness */}
      <div
        ref={tiltRef}
        style={{
          transform: 'perspective(800px) rotateX(0deg) rotateY(0deg)',
          transition: 'transform 0.18s ease-out',
          transformStyle: 'preserve-3d',
        }}
      >
        {/* Card fan — first card straight, others fanned to the left behind */}
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
          {/* Light reflection overlay — controlled via direct DOM for 60fps */}
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

      {/* Pool badge — moved below card so fan doesn't cover it */}
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

      {/* Owned badge */}
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
