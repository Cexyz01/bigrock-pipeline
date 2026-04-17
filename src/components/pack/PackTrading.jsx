import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getTradeTokens, createTradeInvite,
  sendNotification,
} from '../../lib/supabase'
import { hasPermission } from '../../lib/constants'

const D = {
  bg: '#1a1a1a', card: '#222222', border: '#2d2d2d',
  text: '#F1F5F9', sub: '#CBD5E1', muted: '#94A3B8', dim: '#64748B',
}

export default function PackTrading({ user, profiles, addToast, onInviteSent }) {
  const [tokens, setTokens] = useState(null)
  const [loading, setLoading] = useState(true)
  const [targetUser, setTargetUser] = useState('')
  const [inviting, setInviting] = useState(false)

  const admin = hasPermission(user, 'manage_tcg')

  // Load tokens
  const loadData = useCallback(async () => {
    const t = await getTradeTokens(user.id)
    setTokens(t)
    setLoading(false)
  }, [user.id])

  useEffect(() => { loadData() }, [loadData])

  // Filter eligible profiles
  const eligibleProfiles = useMemo(() => {
    if (!profiles) return []
    return profiles.filter(p => {
      if (p.id === user.id) return false
      if (!admin && hasPermission(p, 'manage_tcg')) return false
      return true
    })
  }, [profiles, user.id, admin])

  // Send invite → triggers overlay immediately for proposer
  const handleInvite = async () => {
    if (!targetUser) return
    setInviting(true)
    const { data, error } = await createTradeInvite(user.id, targetUser)
    if (error) {
      addToast(error.message || 'Error sending invite', 'error')
    } else {
      onInviteSent(data.id, data)
      await sendNotification(targetUser, 'trade', 'Trade invite',
        `${user.full_name || 'A user'} wants to trade cards with you!`, 'trade', data.id)
      setTargetUser('')
    }
    setInviting(false)
  }

  const disableInvite = inviting || !tokens || tokens.tokens <= 0

  if (loading) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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

      {/* Select user + invite */}
      <div style={{ width: '100%', maxWidth: 340 }}>
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
      </div>
    </div>
  )
}
