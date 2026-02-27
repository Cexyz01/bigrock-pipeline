import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getTradeTokens, createTradeInvite, acceptTradeInvite, declineTradeInvite,
  cancelTrade, getPendingInvites, getActiveTrade, subscribeToTradeInvites,
  subscribeToTradeSession, sendNotification, supabase,
} from '../../lib/supabase'
import { isAdmin } from '../../lib/constants'

const D = {
  bg: '#1a1a1a', card: '#222222', border: '#2d2d2d',
  text: '#F1F5F9', sub: '#CBD5E1', muted: '#94A3B8', dim: '#64748B',
}

export default function PackTrading({ user, profiles, addToast, onTradeSessionStart }) {
  const [tokens, setTokens] = useState(null)
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [targetUser, setTargetUser] = useState('')
  const [inviting, setInviting] = useState(false)
  const [pendingInviteId, setPendingInviteId] = useState(null)

  const admin = isAdmin(user.role)

  // ── Load initial data ──
  const loadData = useCallback(async () => {
    const [t, inv, active] = await Promise.all([
      getTradeTokens(user.id),
      getPendingInvites(user.id),
      getActiveTrade(user.id),
    ])
    setTokens(t)
    setInvites(inv)
    setLoading(false)
    if (active) onTradeSessionStart(active.id)
  }, [user.id, onTradeSessionStart])

  useEffect(() => { loadData() }, [loadData])

  // ── Realtime: incoming invites ──
  useEffect(() => {
    const channel = subscribeToTradeInvites(user.id, (payload) => {
      const newInvite = payload.new
      if (newInvite && newInvite.status === 'pending_invite') {
        setInvites(prev => {
          if (prev.some(i => i.id === newInvite.id)) return prev
          return [newInvite, ...prev]
        })
        getPendingInvites(user.id).then(setInvites)
      }
    })
    return () => { supabase.removeChannel(channel) }
  }, [user.id])

  // ── Watch outgoing invite for acceptance ──
  useEffect(() => {
    if (!pendingInviteId) return
    const channel = subscribeToTradeSession(pendingInviteId, (payload) => {
      const updated = payload.new
      if (updated.status === 'active') {
        setPendingInviteId(null)
        onTradeSessionStart(updated.id)
      } else if (updated.status === 'rejected' || updated.status === 'cancelled') {
        setPendingInviteId(null)
        addToast('Invite was declined', 'info')
        getTradeTokens(user.id).then(setTokens)
      }
    })
    return () => { supabase.removeChannel(channel) }
  }, [pendingInviteId, onTradeSessionStart, addToast, user.id])

  // ── Filter eligible profiles ──
  const eligibleProfiles = useMemo(() => {
    if (!profiles) return []
    return profiles.filter(p => {
      if (p.id === user.id) return false
      if (!admin && isAdmin(p.role)) return false
      return true
    })
  }, [profiles, user.id, admin])

  // ── Send invite ──
  const handleInvite = async () => {
    if (!targetUser) return
    setInviting(true)
    const { data, error } = await createTradeInvite(user.id, targetUser)
    if (error) {
      addToast(error.message || 'Error sending invite', 'error')
    } else {
      addToast('Trade invite sent!', 'success')
      setPendingInviteId(data.id)
      await sendNotification(targetUser, 'trade', 'Trade invite',
        `${user.full_name || 'A user'} wants to trade cards with you!`, 'trade', data.id)
      setTargetUser('')
    }
    setInviting(false)
  }

  // ── Cancel outgoing invite ──
  const handleCancelInvite = async () => {
    if (!pendingInviteId) return
    const { error } = await cancelTrade(pendingInviteId)
    if (error) {
      addToast(error.message || 'Error cancelling', 'error')
    } else {
      addToast('Invite cancelled', 'info')
    }
    setPendingInviteId(null)
  }

  // ── Accept invite ──
  const handleAccept = async (invite) => {
    const { data, error } = await acceptTradeInvite(invite.id)
    if (error) {
      addToast(error.message || 'Error accepting invite', 'error')
    } else {
      setInvites(prev => prev.filter(i => i.id !== invite.id))
      await sendNotification(invite.proposer_id, 'trade', 'Invite accepted!',
        `${user.full_name || 'A user'} accepted your trade invite`, 'trade', invite.id)
      onTradeSessionStart(invite.id)
    }
  }

  // ── Decline invite ──
  const handleDecline = async (invite) => {
    const { error } = await declineTradeInvite(invite.id)
    if (error) {
      addToast(error.message || 'Error declining', 'error')
    } else {
      setInvites(prev => prev.filter(i => i.id !== invite.id))
      await sendNotification(invite.proposer_id, 'trade', 'Invite declined',
        `${user.full_name || 'A user'} declined your invite`, 'trade', invite.id)
    }
  }

  const disableInvite = inviting || !!pendingInviteId || !tokens || tokens.tokens <= 0

  if (loading) return null

  return (
    <div style={{ marginTop: 32 }}>
      {/* Title */}
      <h2 style={{ fontSize: 18, fontWeight: 800, color: D.text, margin: '0 0 16px', textAlign: 'center' }}>
        Trading
      </h2>

      {/* Token display */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 12, height: 12, borderRadius: '50%',
              background: tokens && i < tokens.tokens ? '#F28C28' : '#2d2d2d',
              border: `2px solid ${tokens && i < tokens.tokens ? '#F5B862' : '#3a3a3a'}`,
              transition: 'all 0.3s ease',
              boxShadow: tokens && i < tokens.tokens ? '0 0 6px rgba(242,140,40,0.4)' : 'none',
            }} />
          ))}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: D.sub }}>Trade Tokens</span>
        <span style={{ fontSize: 10, color: D.muted }}>+1 at midnight</span>
      </div>

      {/* Select user + invite — compact row */}
      <div style={{ marginBottom: 16, maxWidth: 340, margin: '0 auto 16px' }}>
        {!pendingInviteId ? (
          <>
            <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
              <select
                value={targetUser}
                onChange={e => setTargetUser(e.target.value)}
                style={{
                  flex: 1, padding: '7px 10px', borderRadius: 8,
                  border: `1.5px solid ${D.border}`, fontSize: 12,
                  background: D.bg, color: D.text, outline: 'none',
                  minWidth: 0,
                }}
              >
                <option value="">Select user...</option>
                {eligibleProfiles.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
              </select>

              <button
                onClick={handleInvite}
                disabled={!targetUser || disableInvite}
                style={{
                  padding: '7px 14px', borderRadius: 8, border: 'none',
                  fontSize: 11, fontWeight: 700, cursor: (!targetUser || disableInvite) ? 'not-allowed' : 'pointer',
                  background: '#F28C28', color: '#fff', whiteSpace: 'nowrap',
                  opacity: (!targetUser || disableInvite) ? 0.45 : 1,
                  transition: 'all 0.2s',
                }}
              >
                {inviting ? 'Sending...' : 'Invite to trade'}
              </button>
            </div>

            {tokens && tokens.tokens <= 0 && (
              <p style={{ fontSize: 10, color: '#EF4444', marginTop: 6, textAlign: 'center' }}>
                No tokens available. +1 at midnight!
              </p>
            )}
          </>
        ) : (
          <div style={{
            background: D.card, border: `1px solid ${D.border}`, borderRadius: 8,
            padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', background: '#F28C28',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: D.sub }}>
                Waiting for response...
              </span>
            </div>
            <button
              onClick={handleCancelInvite}
              style={{
                padding: '4px 10px', borderRadius: 6, border: `1px solid #EF444450`,
                fontSize: 10, fontWeight: 600, cursor: 'pointer',
                background: 'transparent', color: '#EF4444',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div style={{ maxWidth: 340, margin: '0 auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 8 }}>
            Incoming invites
          </div>
          {invites.map(invite => (
            <div key={invite.id} style={{
              background: D.card, border: `1px solid ${D.border}`, borderRadius: 10,
              padding: 12, marginBottom: 6,
              animation: 'fadeIn 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {invite.proposer?.avatar_url ? (
                  <img src={invite.proposer.avatar_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                ) : (
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', background: '#333',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: '#aaa', fontWeight: 600,
                  }}>
                    {(invite.proposer?.full_name || '?')[0]}
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: D.text }}>
                    {invite.proposer?.full_name || 'User'}
                  </div>
                  <div style={{ fontSize: 10, color: D.muted }}>wants to trade cards!</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => handleAccept(invite)}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    background: '#22C55E', color: '#fff',
                  }}
                >
                  Accept
                </button>
                <button
                  onClick={() => handleDecline(invite)}
                  style={{
                    padding: '6px 14px', borderRadius: 6, border: `1px solid #EF444440`,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: 'transparent', color: '#EF4444',
                  }}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
