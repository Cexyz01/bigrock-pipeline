import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { ScaledCard } from './CardRenderer'
import { RARITY_COLORS } from './PackCard'
import {
  getTradeById, getTradeTokens, getOtherUserCards,
  selectTradeCard, acceptTradeSelection, executeTrade, cancelTrade,
  subscribeToTradeSession, sendNotification, supabase,
} from '../../lib/supabase'
import useIsMobile from '../../hooks/useIsMobile'

const D = {
  bg: '#1a1a1a', card: '#222222', border: '#2d2d2d',
  text: '#F1F5F9', sub: '#CBD5E1', muted: '#94A3B8', dim: '#64748B',
}

const RARITIES = ['common', 'rare', 'gold', 'diamond', 'rainbow']
const RARITY_LABELS = { common: 'Common', rare: 'Rare', gold: 'Gold', diamond: 'Diamond', rainbow: 'Rainbow' }

export default function TradeSession({ tradeId, user, cards, userCards, addToast, onClose }) {
  const isMobile = useIsMobile()
  const [trade, setTrade] = useState(null)
  const [tokens, setTokens] = useState(null)
  const [otherUserCards, setOtherUserCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState(false)
  const [rarityFilter, setRarityFilter] = useState('all')
  const [endState, setEndState] = useState(null) // null | 'completed' | { cancelled: true }
  const closedRef = useRef(false)

  const side = trade?.proposer_id === user.id ? 'proposer' : 'target'
  const otherSide = side === 'proposer' ? 'target' : 'proposer'
  const otherUser = trade ? (side === 'proposer' ? trade.target : trade.proposer) : null
  const otherUserId = trade ? (side === 'proposer' ? trade.target_id : trade.proposer_id) : null

  // Card selections: proposer_card_number = what PROPOSER wants (from target's duplicates)
  const mySelectedNum = trade ? trade[`${side}_card_number`] : null
  const otherSelectedNum = trade ? trade[`${otherSide}_card_number`] : null
  const myAccepted = trade ? trade[`${side}_accepted`] : false
  const otherAccepted = trade ? trade[`${otherSide}_accepted`] : false

  // Load initial data
  const loadTrade = useCallback(async () => {
    const [{ data: t }, tok] = await Promise.all([
      getTradeById(tradeId),
      getTradeTokens(user.id),
    ])
    if (!t) { addToast('Trade not found', 'error'); onClose(); return }
    setTrade(t)
    setTokens(tok)

    const otherId = t.proposer_id === user.id ? t.target_id : t.proposer_id
    const oc = await getOtherUserCards(otherId)
    setOtherUserCards(oc)
    setLoading(false)
  }, [tradeId, user.id, addToast, onClose])

  useEffect(() => { loadTrade() }, [loadTrade])

  // Realtime subscription
  useEffect(() => {
    if (!tradeId) return
    const channel = subscribeToTradeSession(tradeId, async (payload) => {
      const updated = payload.new
      setTrade(prev => prev ? { ...prev, ...updated } : updated)

      // Both accepted → execute (proposer triggers)
      if (updated.proposer_accepted && updated.target_accepted &&
          updated.proposer_card_number != null && updated.target_card_number != null &&
          updated.status === 'active') {
        if (updated.proposer_id === user.id) {
          setExecuting(true)
          const { error } = await executeTrade(tradeId)
          if (error) {
            addToast(error.message || 'Trade error', 'error')
            setExecuting(false)
          }
        }
      }

      if (updated.status === 'completed') setEndState('completed')
      if (updated.status === 'cancelled' && !closedRef.current) setEndState({ cancelled: true })
    })
    return () => { supabase.removeChannel(channel) }
  }, [tradeId, user.id, addToast])

  // Other player's duplicates (≥2 copies)
  const otherDuplicates = useMemo(() => {
    if (!otherUserCards || !cards) return []
    const counts = {}
    for (const uc of otherUserCards) {
      if (!counts[uc.card_number]) counts[uc.card_number] = 0
      counts[uc.card_number]++
    }
    const dupNums = new Set(Object.keys(counts).filter(k => counts[k] >= 2).map(Number))
    return cards.filter(c => dupNums.has(c.number))
  }, [otherUserCards, cards])

  const filteredDuplicates = useMemo(() => {
    if (rarityFilter === 'all') return otherDuplicates
    return otherDuplicates.filter(c => c.rarity === rarityFilter)
  }, [otherDuplicates, rarityFilter])

  const availableRarities = useMemo(() => {
    const set = new Set(otherDuplicates.map(c => c.rarity))
    return RARITIES.filter(r => set.has(r))
  }, [otherDuplicates])

  const mySelectedCard = mySelectedNum != null ? cards.find(c => c.number === mySelectedNum) : null
  const otherSelectedCard = otherSelectedNum != null ? cards.find(c => c.number === otherSelectedNum) : null
  const sameRarity = mySelectedCard && otherSelectedCard && mySelectedCard.rarity === otherSelectedCard.rarity

  const handleSelectCard = async (card) => {
    if (!trade || trade.status !== 'active' || endState) return
    const newNum = mySelectedNum === card.number ? null : card.number
    setTrade(prev => ({
      ...prev,
      [`${side}_card_number`]: newNum,
      proposer_accepted: false,
      target_accepted: false,
    }))
    await selectTradeCard(tradeId, side, newNum)
  }

  const handleAccept = async () => {
    if (!sameRarity || myAccepted || endState) return
    setTrade(prev => ({ ...prev, [`${side}_accepted`]: true }))
    await acceptTradeSelection(tradeId, side)
  }

  const handleCancel = async () => {
    if (endState) return
    closedRef.current = true
    await cancelTrade(tradeId)
    await sendNotification(otherUserId, 'trade', 'Trade cancelled',
      `${user.full_name || 'A user'} cancelled the trade`, 'trade', tradeId)
    onClose()
  }

  // Loading
  if (loading || !trade) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: D.muted, fontSize: 14,
      }}>
        Loading trade session...
      </div>
    )
  }

  // End-state popup
  if (endState) {
    const isCompleted = endState === 'completed'
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: D.card, border: `1px solid ${D.border}`, borderRadius: 20,
          padding: isMobile ? 28 : 36, width: isMobile ? '85%' : 380,
          maxWidth: 400, textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          animation: 'tradeEndPop 0.3s ease',
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
            background: isCompleted ? '#22C55E20' : '#EF444420',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28,
          }}>
            {isCompleted ? '✓' : '✕'}
          </div>

          <h3 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: isCompleted ? '#22C55E' : '#EF4444' }}>
            {isCompleted ? 'Trade Completed!' : 'Trade Cancelled'}
          </h3>
          <p style={{ fontSize: 13, color: D.sub, margin: '0 0 24px' }}>
            {isCompleted
              ? 'Cards have been swapped successfully.'
              : `${otherUser?.full_name || 'The other player'} has cancelled the trade.`
            }
          </p>

          <button onClick={onClose} style={{
            width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
            fontSize: 14, fontWeight: 700, cursor: 'pointer',
            background: isCompleted ? '#22C55E' : '#F28C28', color: '#fff',
          }}>
            OK
          </button>
        </div>

        <style>{`@keyframes tradeEndPop { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Popup — 60% desktop, 95% mobile */}
      <div style={{
        background: D.bg, border: `1px solid ${D.border}`,
        borderRadius: isMobile ? 16 : 20,
        width: isMobile ? '95%' : '60%', maxWidth: 900,
        height: isMobile ? '90%' : '80%', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 80px rgba(0,0,0,0.6)',
        animation: 'tradeSessionIn 0.3s ease',
      }}>
        {/* Header */}
        <div style={{
          padding: isMobile ? '10px 14px' : '12px 24px',
          borderBottom: `1px solid ${D.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: isMobile ? 14 : 16, fontWeight: 800, color: D.text, margin: 0 }}>Trade Session</h2>
            <div style={{ display: 'flex', gap: 3 }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: tokens && i < tokens.tokens ? '#F28C28' : '#2d2d2d',
                  border: `1.5px solid ${tokens && i < tokens.tokens ? '#F5B862' : '#3a3a3a'}`,
                }} />
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: D.sub, fontWeight: 600 }}>
              {user.full_name?.split(' ')[0]} vs {otherUser?.full_name?.split(' ')[0]}
            </span>
            <button onClick={handleCancel} title="Cancel trade" style={{
              width: 28, height: 28, borderRadius: 8, border: 'none',
              background: '#EF444420', color: '#EF4444',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 14, fontWeight: 700,
            }}>✕</button>
          </div>
        </div>

        {/* Trade zone */}
        <div style={{
          padding: isMobile ? '12px 10px' : '16px 24px',
          flexShrink: 0, borderBottom: `1px solid ${D.border}`,
        }}>
          <div style={{
            background: D.card, border: `1px solid ${D.border}`, borderRadius: 14,
            padding: isMobile ? 12 : 16, maxWidth: 550, margin: '0 auto',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: isMobile ? 12 : 24, marginBottom: 12,
            }}>
              {/* You get */}
              <div style={{ textAlign: 'center', flex: 1, maxWidth: 140 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#22C55E', marginBottom: 4, textTransform: 'uppercase' }}>You get</div>
                {mySelectedCard ? (
                  <div style={{ borderRadius: 8, border: `2px solid ${myAccepted ? '#22C55E' : '#F28C28'}`, padding: 2, transition: 'border-color 0.3s' }}>
                    <ScaledCard card={mySelectedCard} owned={true} />
                  </div>
                ) : (
                  <div style={{
                    aspectRatio: '2.5/3.5', borderRadius: 8, border: `2px dashed ${D.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: D.muted, padding: 6,
                  }}>Pick a card below</div>
                )}
                <div style={{ marginTop: 4, fontSize: 9, fontWeight: 600, color: myAccepted ? '#22C55E' : D.muted }}>
                  {myAccepted ? '✓ Accepted' : mySelectedCard ? 'Not accepted' : '—'}
                </div>
              </div>

              <div style={{ fontSize: isMobile ? 20 : 28, color: D.dim, flexShrink: 0 }}>⇄</div>

              {/* You give */}
              <div style={{ textAlign: 'center', flex: 1, maxWidth: 140 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#EF4444', marginBottom: 4, textTransform: 'uppercase' }}>You give</div>
                {otherSelectedCard ? (
                  <div style={{ borderRadius: 8, border: `2px solid ${otherAccepted ? '#22C55E' : '#3B82F6'}`, padding: 2, transition: 'border-color 0.3s' }}>
                    <ScaledCard card={otherSelectedCard} owned={true} />
                  </div>
                ) : (
                  <div style={{
                    aspectRatio: '2.5/3.5', borderRadius: 8, border: `2px dashed ${D.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: D.muted, padding: 6,
                  }}>{otherUser?.full_name?.split(' ')[0] || 'Other'} picking...</div>
                )}
                <div style={{ marginTop: 4, fontSize: 9, fontWeight: 600, color: otherAccepted ? '#22C55E' : D.muted }}>
                  {otherAccepted ? '✓ Accepted' : otherSelectedCard ? 'Waiting' : '—'}
                </div>
              </div>
            </div>

            {mySelectedCard && otherSelectedCard && !sameRarity && (
              <div style={{
                textAlign: 'center', padding: '5px 10px', borderRadius: 8,
                background: '#EF444420', color: '#EF4444', fontSize: 10, fontWeight: 600, marginBottom: 8,
              }}>Cards must be the same rarity!</div>
            )}

            <button onClick={handleAccept} disabled={!sameRarity || myAccepted || executing} style={{
              width: '100%', padding: '10px 0', borderRadius: 10, border: 'none',
              fontSize: 13, fontWeight: 800,
              cursor: (!sameRarity || myAccepted || executing) ? 'not-allowed' : 'pointer',
              background: myAccepted ? '#22C55E40' : (sameRarity ? '#22C55E' : '#333'),
              color: myAccepted ? '#22C55E' : (sameRarity ? '#fff' : '#666'),
              opacity: (!sameRarity || executing) ? 0.4 : 1, transition: 'all 0.3s ease',
            }}>
              {executing ? 'Trading...' : myAccepted ? '✓ ACCEPTED — Waiting...' : 'ACCEPT TRADE'}
            </button>
          </div>
        </div>

        {/* Card grid — other player's duplicates */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: isMobile ? '10px 10px 0' : '12px 24px 0', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: D.sub, marginBottom: 6 }}>
              {otherUser?.full_name?.split(' ')[0] || 'Their'}'s duplicates — pick what you want
            </div>
            {availableRarities.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setRarityFilter('all')} style={{
                  padding: '3px 10px', borderRadius: 12, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                  background: rarityFilter === 'all' ? '#F28C28' : D.card,
                  color: rarityFilter === 'all' ? '#fff' : D.sub,
                  border: `1px solid ${rarityFilter === 'all' ? 'transparent' : D.border}`,
                }}>All</button>
                {availableRarities.map(r => (
                  <button key={r} onClick={() => setRarityFilter(r)} style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                    background: rarityFilter === r ? (RARITY_COLORS[r]?.border || '#F28C28') : D.card,
                    color: rarityFilter === r ? '#fff' : D.sub,
                    border: `1px solid ${rarityFilter === r ? 'transparent' : D.border}`,
                  }}>{RARITY_LABELS[r]}</button>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: isMobile ? '6px 10px 16px' : '6px 24px 20px' }}>
            {filteredDuplicates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: D.muted, fontSize: 11 }}>No duplicates available</div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(80px, 1fr))' : 'repeat(auto-fill, minmax(120px, 1fr))',
                gap: isMobile ? 6 : 8,
              }}>
                {filteredDuplicates.map(card => {
                  const isSelected = mySelectedNum === card.number
                  return (
                    <div key={card.number} onClick={() => handleSelectCard(card)} style={{
                      cursor: 'pointer', borderRadius: 8,
                      border: `2px solid ${isSelected ? '#F28C28' : 'transparent'}`,
                      padding: 2, transition: 'all 0.2s',
                      transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                      boxShadow: isSelected ? '0 4px 16px rgba(242,140,40,0.3)' : 'none',
                    }}>
                      <ScaledCard card={card} owned={true} />
                      <div style={{
                        textAlign: 'center', fontSize: 8, fontWeight: 600,
                        color: RARITY_COLORS[card.rarity]?.border || D.muted, marginTop: 2,
                      }}>{RARITY_LABELS[card.rarity]}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes tradeSessionIn { from { opacity:0; transform:scale(0.95); } to { opacity:1; transform:scale(1); } }`}</style>
    </div>
  )
}
