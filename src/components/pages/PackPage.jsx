import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { getPackCards, getUserCards, grantCard as grantCardApi, getUserTimer, upsertUserTimer, getPacksRemaining, claimAndOpenPack, getPackConfig, subscribeToTable, supabase } from '../../lib/supabase'
import { isStaff, isAdmin, PACK_TYPES, PACK_RARITIES } from '../../lib/constants'
import PackCard, { RARITY_COLORS } from '../pack/PackCard'
import { ScaledCard } from '../pack/CardRenderer'
import PackShop from '../pack/PackShop'
import PackAdminPanel from '../pack/PackAdminPanel'
import PackOpening from '../pack/PackOpening'
import { IconX } from '../ui/Icons'
import Fade from '../ui/Fade'

const D = {
  bg: '#0B0E14',
  card: '#141820',
  border: '#1E2530',
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

export default function PackPage({ user, profiles, addToast, requestConfirm, tcgGameActive, onGameStateChange }) {
  const [tab, setTab] = useState('collection')
  const [cards, setCards] = useState([])
  const [userCards, setUserCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [rarityFilter, setRarityFilter] = useState('all')
  const [poolFilter, setPoolFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [selectedOwned, setSelectedOwned] = useState(false)

  const [timer, setTimer] = useState(null)
  const [remaining, setRemaining] = useState({ red: 0, green: 0, blue: 0 })
  const [copiesPerRarity, setCopiesPerRarity] = useState({})

  // Pack opening — optimistic render + fly transition
  const [openingPack, setOpeningPack] = useState(null) // { pack_type, cards: [...] } or null
  const [openingPackType, setOpeningPackType] = useState(null) // set immediately on click
  const [flyRect, setFlyRect] = useState(null) // bounding rect of clicked pack in shop

  // Staff grant
  const [grantOpen, setGrantOpen] = useState(false)
  const [grantUser, setGrantUser] = useState('')
  const [grantNum, setGrantNum] = useState('')
  const [granting, setGranting] = useState(false)

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
  }

  const ownedSet = useMemo(() => new Set(userCards.map(uc => uc.card_number)), [userCards])

  const copyInfoMap = useMemo(() => {
    const m = {}
    for (const uc of userCards) {
      if (uc.copy_number != null) m[uc.card_number] = String(uc.copy_number).padStart(3, '0')
    }
    return m
  }, [userCards])

  const filteredCards = useMemo(() => {
    let filtered = cards
    if (poolFilter !== 'all') filtered = filtered.filter(c => c.pack_type === poolFilter)
    if (rarityFilter !== 'all') filtered = filtered.filter(c => c.rarity === rarityFilter)
    return filtered
  }, [cards, rarityFilter, poolFilter])

  const ownedCount = ownedSet.size
  const totalCount = cards.length

  const handleCardClick = (card, owned) => {
    setSelected(card)
    setSelectedOwned(owned)
  }

  const handleOpenPack = async (packType, rect) => {
    if (!canOpenPacks) {
      addToast(admin ? 'Admins cannot open packs during active game' : 'You cannot open packs right now', 'error')
      return
    }
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
  const admin = isAdmin(user.role)
  const canOpenPacks = tcgGameActive ? !admin : admin

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
    <Fade>
      <div style={{
        background: D.bg,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}>
        {/* Top bar */}
        <div style={{
          padding: '14px 28px',
          borderBottom: `1px solid ${D.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div>
              <img src="/images/title_image_tcg.png" alt="BigRock TCG" draggable={false} style={{ height: 36, display: 'block' }} />
              <p style={{ fontSize: 12, color: D.sub, margin: '4px 0 0' }}>
                {ownedCount}/{totalCount} cards collected
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 120, height: 6, borderRadius: 3, background: D.border, overflow: 'hidden' }}>
                <div style={{
                  width: `${totalCount ? (ownedCount / totalCount * 100) : 0}%`,
                  height: '100%', borderRadius: 3,
                  background: 'linear-gradient(90deg, #6C5CE7, #A29BFE)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#A29BFE' }}>
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
                    background: tab === t.id ? '#6C5CE7' : 'transparent',
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
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {/* LEFT: Shop — wide */}
            <div style={{
              width: '42%',
              minWidth: 500,
              maxWidth: 780,
              borderRight: `1px solid ${D.border}`,
              padding: '24px 32px',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              flexShrink: 0,
            }}>
              <PackShop remaining={remaining} timer={timer} onOpenPack={handleOpenPack} isAdmin={admin} onResetPacks={handleResetPacks} canOpenPacks={canOpenPacks} />
            </div>

            {/* RIGHT: Collection */}
            <div style={{
              flex: 1,
              padding: '18px 24px',
              overflowY: 'auto',
              minWidth: 0,
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
                        background: poolFilter === p ? (pt ? pt.color : '#6C5CE7') : D.card,
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: D.sub, marginRight: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rarity:</span>
                {RARITIES.map(r => (
                  <button
                    key={r}
                    onClick={() => setRarityFilter(r)}
                    style={{
                      padding: '4px 12px', borderRadius: 14, fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s',
                      background: rarityFilter === r ? (RARITY_COLORS[r]?.border || '#6C5CE7') : D.card,
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
                      border: '1.5px solid #6C5CE740', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', background: 'transparent', color: '#A29BFE', transition: 'all 0.2s',
                    }}
                  >
                    + Assign card
                  </button>
                )}
              </div>

              {/* Card Grid — 7 per row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 12,
              }}>
                {filteredCards.map(card => (
                  <PackCard
                    key={card.number}
                    card={card}
                    owned={ownedSet.has(card.number)}
                    onClick={handleCardClick}
                    copyInfo={copyInfoMap[card.number]}
                    totalCopies={copiesPerRarity?.[card.rarity]}
                  />
                ))}
              </div>

              {filteredCards.length === 0 && (
                <div style={{ textAlign: 'center', padding: 60, color: D.muted, fontSize: 14 }}>
                  No cards in this category
                </div>
              )}
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
        onClick={() => setSelected(null)}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(5,5,15,0.7)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none', WebkitUserSelect: 'none',
        }}
      >
        <div onClick={e => e.stopPropagation()} style={{
          background: D.card, border: `1px solid ${D.border}`, borderRadius: 20,
          padding: 28, width: '90%', maxWidth: 420, maxHeight: '85vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          animation: 'modalIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: D.text, margin: 0, flex: 1, marginRight: 12 }}>
              {selectedOwned ? (selected.name || '').replace(/\s*#\d+$/, '') : 'Unknown card'}
            </h2>
            <button onClick={() => setSelected(null)} style={{
              background: '#1E2530', border: 'none', color: D.muted, borderRadius: 8,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <IconX size={16} />
            </button>
          </div>
          <CardDetail card={selected} owned={selectedOwned} rarity={RARITY_COLORS[selected.rarity]} copyInfo={copyInfoMap[selected.number]} cards={cards} copiesPerRarity={copiesPerRarity} />
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
          background: 'rgba(5,5,15,0.7)',
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
              background: '#1E2530', border: 'none', color: D.muted, borderRadius: 8,
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
              cursor: granting ? 'wait' : 'pointer', background: '#6C5CE7', color: '#fff',
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
      />,
      document.body
    )}

  </>
  )
}

function CardDetail({ card, owned, rarity, copyInfo, cards, copiesPerRarity }) {
  const pt = PACK_TYPES.find(p => p.id === card.pack_type)
  const totalCopies = copiesPerRarity?.[card.rarity] || '?'

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Pool badge */}
      {pt && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 12,
          background: `${pt.color}20`, color: pt.color, fontSize: 11, fontWeight: 700, marginBottom: 14,
        }}>
          Pool {pt.label}
        </div>
      )}

      {/* Card preview — unified ScaledCard */}
      <div style={{ maxWidth: 240, margin: '0 auto 16px' }}>
        <ScaledCard card={card} owned={owned} copyInfo={copyInfo} totalCopies={totalCopies} />
      </div>

      {/* Owned badge */}
      {owned ? (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
          background: 'rgba(16,185,129,0.15)', color: '#10B981', fontSize: 12, fontWeight: 600,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          Owned
        </div>
      ) : (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20,
          background: '#1E2530', color: '#94A3B8', fontSize: 12, fontWeight: 600,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
          Not owned
        </div>
      )}
    </div>
  )
}
