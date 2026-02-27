import { useState, useEffect, useMemo, useCallback } from 'react'
import { ScaledCard } from './CardRenderer'
import { RARITY_COLORS } from './PackCard'
import {
  getTradeById, getTradeTokens, getOtherUserCards, selectTradeCard,
  acceptTradeSelection, executeTrade, cancelTrade,
  subscribeToTradeSession, sendNotification, supabase,
} from '../../lib/supabase'
import { PACK_TYPES } from '../../lib/constants'
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

  const side = trade?.proposer_id === user.id ? 'proposer' : 'target'
  const otherSide = side === 'proposer' ? 'target' : 'proposer'
  const otherUser = trade ? (side === 'proposer' ? trade.target : trade.proposer) : null
  const otherUserId = trade ? (side === 'proposer' ? trade.target_id : trade.proposer_id) : null

  const myCardNum = trade ? trade[`${side}_card_number`] : null
  const otherCardNum = trade ? trade[`${otherSide}_card_number`] : null
  const myAccepted = trade ? trade[`${side}_accepted`] : false
  const otherAccepted = trade ? trade[`${otherSide}_accepted`] : false

  // ── Load initial data ──
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

  // ── Realtime subscription ──
  useEffect(() => {
    if (!tradeId) return
    const channel = subscribeToTradeSession(tradeId, async (payload) => {
      const updated = payload.new
      setTrade(prev => {
        if (!prev) return updated
        return { ...prev, ...updated }
      })

      if (updated.proposer_accepted && updated.target_accepted &&
          updated.proposer_card_number != null && updated.target_card_number != null &&
          updated.status === 'active') {
        if (updated.proposer_id === user.id) {
          setExecuting(true)
          const { data, error } = await executeTrade(tradeId)
          if (error) {
            addToast(error.message || 'Trade error', 'error')
            setExecuting(false)
          }
        }
      }

      if (updated.status === 'completed') {
        addToast('Trade completed! Cards have been transferred', 'success')
        setTimeout(() => onClose(), 1200)
      }

      if (updated.status === 'cancelled') {
        addToast('Trade was cancelled', 'info')
        setTimeout(() => onClose(), 600)
      }
    })
    return () => { supabase.removeChannel(channel) }
  }, [tradeId, user.id, addToast, onClose])

  // ── My duplicates (cards with >=2 copies) ──
  const myDuplicates = useMemo(() => {
    if (!userCards || !cards) return []
    const counts = {}
    for (const uc of userCards) {
      if (!counts[uc.card_number]) counts[uc.card_number] = 0
      counts[uc.card_number]++
    }
    const dupNums = new Set(Object.keys(counts).filter(k => counts[k] >= 2).map(Number))
    return cards.filter(c => dupNums.has(c.number))
  }, [userCards, cards])

  const filteredDuplicates = useMemo(() => {
    if (rarityFilter === 'all') return myDuplicates
    return myDuplicates.filter(c => c.rarity === rarityFilter)
  }, [myDuplicates, rarityFilter])

  const availableRarities = useMemo(() => {
    const set = new Set(myDuplicates.map(c => c.rarity))
    return RARITIES.filter(r => set.has(r))
  }, [myDuplicates])

  const myCard = myCardNum != null ? cards.find(c => c.number === myCardNum) : null
  const otherCard = otherCardNum != null ? cards.find(c => c.number === otherCardNum) : null
  const sameRarity = myCard && otherCard && myCard.rarity === otherCard.rarity

  const handleSelectCard = async (card) => {
    if (!trade || trade.status !== 'active') return
    const newNum = myCardNum === card.number ? null : card.number
    setTrade(prev => ({
      ...prev,
      [`${side}_card_number`]: newNum,
      proposer_accepted: false,
      target_accepted: false,
    }))
    await selectTradeCard(tradeId, side, newNum)
  }

  const handleAccept = async () => {
    if (!sameRarity || myAccepted) return
    setTrade(prev => ({ ...prev, [`${side}_accepted`]: true }))
    await acceptTradeSelection(tradeId, side)
  }

  const handleCancel = async () => {
    await cancelTrade(tradeId)
    await sendNotification(otherUserId, 'trade', 'Trade cancelled',
      `${user.full_name || 'A user'} cancelled the trade`, 'trade', tradeId)
  }

  if (loading || !trade) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9500,
        background: 'rgba(0,0,0,0.95)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: D.muted, fontSize: 14,
      }}>
        Loading trade session...
      </div>
    )
  }

  const isCompleted = trade.status === 'completed'
  const isCancelled = trade.status === 'cancelled'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9500,
      background: D.bg,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      animation: 'fadeIn 0.3s ease',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: isMobile ? '12px 16px' : '14px 28px',
        borderBottom: `1px solid ${D.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: D.text, margin: 0 }}>
            Trade Session
          </h2>
          <div style={{ display: 'flex', gap: 3 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%',
                background: tokens && i < tokens.tokens ? '#F28C28' : '#2d2d2d',
                border: `2px solid ${tokens && i < tokens.tokens ? '#F5B862' : '#3a3a3a'}`,
              }} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: D.sub }}>
            <span style={{ fontWeight: 600 }}>{user.full_name?.split(' ')[0] || 'You'}</span>
            <span style={{ color: D.dim }}>vs</span>
            <span style={{ fontWeight: 600 }}>{otherUser?.full_name?.split(' ')[0] || 'User'}</span>
          </div>

          <button
            onClick={handleCancel}
            disabled={isCompleted || isCancelled}
            style={{
              padding: '6px 14px', borderRadius: 8,
              border: `1px solid #EF444460`, background: 'transparent',
              color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              opacity: (isCompleted || isCancelled) ? 0.4 : 1,
            }}
          >
            Cancel Trade
          </button>
        </div>
      </div>

      {/* ── Trade Zone ── */}
      <div style={{
        padding: isMobile ? '16px 12px' : '24px 32px',
        flexShrink: 0,
        borderBottom: `1px solid ${D.border}`,
      }}>
        <div style={{
          background: D.card, border: `1px solid ${D.border}`, borderRadius: 16,
          padding: isMobile ? 16 : 24,
          maxWidth: 600, margin: '0 auto',
        }}>
          {/* Cards face-off */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: isMobile ? 16 : 32,
            marginBottom: 16,
          }}>
            {/* My card */}
            <div style={{ textAlign: 'center', flex: 1, maxWidth: 180 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: D.sub, marginBottom: 6, textTransform: 'uppercase' }}>
                You
              </div>
              {myCard ? (
                <div style={{
                  borderRadius: 10,
                  border: `2px solid ${myAccepted ? '#22C55E' : '#F28C28'}`,
                  padding: 3,
                  transition: 'border-color 0.3s',
                }}>
                  <ScaledCard card={myCard} owned={true} />
                </div>
              ) : (
                <div style={{
                  aspectRatio: '2.5/3.5', borderRadius: 10,
                  border: `2px dashed ${D.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: D.muted, textAlign: 'center', padding: 8,
                }}>
                  Select a card
                </div>
              )}
              <div style={{
                marginTop: 6, fontSize: 10, fontWeight: 600,
                color: myAccepted ? '#22C55E' : D.muted,
              }}>
                {myAccepted ? '✓ Accepted' : 'Not accepted'}
              </div>
            </div>

            {/* Arrow */}
            <div style={{ fontSize: isMobile ? 24 : 32, color: D.dim, flexShrink: 0 }}>
              {isCompleted ? '✓' : '⇄'}
            </div>

            {/* Other card */}
            <div style={{ textAlign: 'center', flex: 1, maxWidth: 180 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: D.sub, marginBottom: 6, textTransform: 'uppercase' }}>
                {otherUser?.full_name?.split(' ')[0] || 'User'}
              </div>
              {otherCard ? (
                <div style={{
                  borderRadius: 10,
                  border: `2px solid ${otherAccepted ? '#22C55E' : '#3B82F6'}`,
                  padding: 3,
                  transition: 'border-color 0.3s',
                }}>
                  <ScaledCard card={otherCard} owned={true} />
                </div>
              ) : (
                <div style={{
                  aspectRatio: '2.5/3.5', borderRadius: 10,
                  border: `2px dashed ${D.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: D.muted, textAlign: 'center', padding: 8,
                }}>
                  Waiting...
                </div>
              )}
              <div style={{
                marginTop: 6, fontSize: 10, fontWeight: 600,
                color: otherAccepted ? '#22C55E' : D.muted,
              }}>
                {otherAccepted ? '✓ Accepted' : 'Waiting'}
              </div>
            </div>
          </div>

          {/* Rarity mismatch warning */}
          {myCard && otherCard && !sameRarity && (
            <div style={{
              textAlign: 'center', padding: '6px 12px', borderRadius: 8,
              background: '#EF444420', color: '#EF4444', fontSize: 11, fontWeight: 600,
              marginBottom: 10,
            }}>
              Cards must be the same rarity!
            </div>
          )}

          {/* Accept button */}
          {!isCompleted && !isCancelled && (
            <button
              onClick={handleAccept}
              disabled={!sameRarity || myAccepted || executing}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 10, border: 'none',
                fontSize: 14, fontWeight: 800, cursor: (!sameRarity || myAccepted || executing) ? 'not-allowed' : 'pointer',
                background: myAccepted ? '#22C55E40' : (sameRarity ? '#22C55E' : '#333'),
                color: myAccepted ? '#22C55E' : (sameRarity ? '#fff' : '#666'),
                opacity: (!sameRarity || executing) ? 0.4 : 1,
                transition: 'all 0.3s ease',
                letterSpacing: '0.5px',
              }}
            >
              {executing ? 'Trading...' : myAccepted ? '✓ ACCEPTED — Waiting for other player' : 'ACCEPT TRADE'}
            </button>
          )}

          {/* Completed */}
          {isCompleted && (
            <div style={{
              textAlign: 'center', padding: '12px 0', borderRadius: 10,
              background: '#22C55E20', color: '#22C55E', fontSize: 14, fontWeight: 800,
            }}>
              Trade completed!
            </div>
          )}
        </div>
      </div>

      {/* ── My duplicates grid ── */}
      {!isCompleted && !isCancelled && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            padding: isMobile ? '12px 12px 0' : '16px 32px 0',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: D.sub, marginBottom: 8 }}>
              Your duplicates — select a card to trade
            </div>

            {availableRarities.length > 0 && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setRarityFilter('all')}
                  style={{
                    padding: '4px 12px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.2s',
                    background: rarityFilter === 'all' ? '#F28C28' : D.card,
                    color: rarityFilter === 'all' ? '#fff' : D.sub,
                    border: `1px solid ${rarityFilter === 'all' ? 'transparent' : D.border}`,
                  }}
                >All</button>
                {availableRarities.map(r => (
                  <button
                    key={r}
                    onClick={() => setRarityFilter(r)}
                    style={{
                      padding: '4px 12px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                      cursor: 'pointer', transition: 'all 0.2s',
                      background: rarityFilter === r ? (RARITY_COLORS[r]?.border || '#F28C28') : D.card,
                      color: rarityFilter === r ? '#fff' : D.sub,
                      border: `1px solid ${rarityFilter === r ? 'transparent' : D.border}`,
                    }}
                  >{RARITY_LABELS[r]}</button>
                ))}
              </div>
            )}
          </div>

          <div style={{
            flex: 1, minHeight: 0, overflowY: 'auto',
            padding: isMobile ? '8px 12px 24px' : '8px 32px 32px',
          }}>
            {filteredDuplicates.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 30, color: D.muted, fontSize: 12 }}>
                No duplicates available
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(90px, 1fr))' : 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: isMobile ? 6 : 10,
              }}>
                {filteredDuplicates.map(card => {
                  const isSelected = myCardNum === card.number
                  return (
                    <div
                      key={card.number}
                      onClick={() => handleSelectCard(card)}
                      style={{
                        cursor: 'pointer', borderRadius: 10,
                        border: `2px solid ${isSelected ? '#F28C28' : 'transparent'}`,
                        padding: 2,
                        transition: 'all 0.2s',
                        transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                        boxShadow: isSelected ? '0 4px 16px rgba(242,140,40,0.3)' : 'none',
                      }}
                    >
                      <ScaledCard card={card} owned={true} />
                      <div style={{
                        textAlign: 'center', fontSize: 9, fontWeight: 600,
                        color: RARITY_COLORS[card.rarity]?.border || D.muted,
                        marginTop: 2,
                      }}>
                        {RARITY_LABELS[card.rarity]}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
