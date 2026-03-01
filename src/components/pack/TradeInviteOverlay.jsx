import { useState, useEffect, useRef, useCallback } from 'react'
import {
  acceptTradeInvite, declineTradeInvite, cancelTrade,
  subscribeToTradeSession, supabase,
} from '../../lib/supabase'
import useIsMobile from '../../hooks/useIsMobile'

const D = {
  bg: '#1a1a1a', card: '#222222', border: '#2d2d2d',
  text: '#F1F5F9', sub: '#CBD5E1', muted: '#94A3B8', dim: '#64748B',
}

const INVITE_TIMEOUT = 10 // seconds

export default function TradeInviteOverlay({ tradeId, trade, role, onAccepted, onClose, addToast }) {
  const isMobile = useIsMobile()
  const [timeLeft, setTimeLeft] = useState(INVITE_TIMEOUT)
  const [status, setStatus] = useState('waiting') // 'waiting' | 'accepted' | 'declined' | 'cancelled' | 'timeout'
  const closedRef = useRef(false)
  const channelRef = useRef(null)

  const isProposer = role === 'proposer'
  const otherUser = isProposer ? trade?.target : trade?.proposer

  // Clean close helper
  const doClose = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    onClose()
  }, [onClose])

  // Countdown timer
  useEffect(() => {
    if (status !== 'waiting') return
    const iv = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(iv)
          setStatus('timeout')
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [status])

  // Auto-cancel on timeout
  useEffect(() => {
    if (status !== 'timeout') return
    cancelTrade(tradeId).catch(() => {})
    const t = setTimeout(() => doClose(), 1500)
    return () => clearTimeout(t)
  }, [status, tradeId, doClose])

  // Realtime subscription
  useEffect(() => {
    if (!tradeId) return
    const channel = subscribeToTradeSession(tradeId, (payload) => {
      const updated = payload.new
      if (updated.status === 'active') {
        setStatus('accepted')
        setTimeout(() => onAccepted(tradeId), 400)
      } else if (updated.status === 'rejected') {
        setStatus('declined')
        setTimeout(() => doClose(), 1500)
      } else if (updated.status === 'cancelled') {
        setStatus('cancelled')
        setTimeout(() => doClose(), 1500)
      }
    })
    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [tradeId, onAccepted, doClose])

  // Accept
  const handleAccept = async () => {
    if (status !== 'waiting') return
    const { error } = await acceptTradeInvite(tradeId)
    if (error) {
      addToast('Error accepting invite', 'error')
    }
    // Realtime will catch the status change → 'active'
  }

  // Decline
  const handleDecline = async () => {
    if (status !== 'waiting') return
    await declineTradeInvite(tradeId)
    setStatus('declined')
    setTimeout(() => doClose(), 800)
  }

  // Cancel (proposer)
  const handleCancel = async () => {
    if (status !== 'waiting') return
    await cancelTrade(tradeId)
    setStatus('cancelled')
    setTimeout(() => doClose(), 800)
  }

  const statusMessage = {
    timeout: 'Time expired!',
    declined: 'Invite declined',
    cancelled: 'Invite cancelled',
    accepted: 'Accepted!',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9600,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'tradeOverlayIn 0.25s ease',
    }}>
      <div style={{
        background: D.card, border: `1px solid ${D.border}`, borderRadius: 20,
        padding: isMobile ? 24 : 32, width: isMobile ? '90%' : 400,
        maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        textAlign: 'center',
        animation: 'tradePopIn 0.3s ease',
      }}>
        {/* Avatar */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
          background: '#333', overflow: 'hidden',
          border: '3px solid #F28C28',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {otherUser?.avatar_url ? (
            <img src={otherUser.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 20, fontWeight: 700, color: '#aaa' }}>
              {(otherUser?.full_name || '?')[0]}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 style={{ fontSize: 18, fontWeight: 800, color: D.text, margin: '0 0 6px' }}>
          {isProposer ? 'Invite sent!' : 'Trade invite!'}
        </h3>
        <p style={{ fontSize: 13, color: D.sub, margin: '0 0 20px' }}>
          {isProposer
            ? `Waiting for ${otherUser?.full_name || 'user'} to respond...`
            : `${otherUser?.full_name || 'A user'} wants to trade cards with you!`
          }
        </p>

        {/* Status message (timeout/declined/cancelled/accepted) */}
        {status !== 'waiting' && (
          <div style={{
            padding: '10px 16px', borderRadius: 10, marginBottom: 16,
            background: status === 'accepted' ? '#22C55E20' : '#EF444420',
            color: status === 'accepted' ? '#22C55E' : '#EF4444',
            fontSize: 14, fontWeight: 700,
          }}>
            {statusMessage[status]}
          </div>
        )}

        {/* Timer bar */}
        {status === 'waiting' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              height: 6, borderRadius: 3, background: '#2d2d2d', overflow: 'hidden',
              marginBottom: 8,
            }}>
              <div style={{
                width: `${(timeLeft / INVITE_TIMEOUT) * 100}%`,
                height: '100%', borderRadius: 3,
                background: timeLeft <= 3
                  ? 'linear-gradient(90deg, #EF4444, #F87171)'
                  : 'linear-gradient(90deg, #F28C28, #F5B862)',
                transition: 'width 1s linear, background 0.3s',
              }} />
            </div>
            <span style={{
              fontSize: 24, fontWeight: 800, fontFamily: 'monospace',
              color: timeLeft <= 3 ? '#EF4444' : '#F5B862',
            }}>
              {timeLeft}
            </span>
          </div>
        )}

        {/* Buttons */}
        {status === 'waiting' && (
          <div style={{ display: 'flex', gap: 10 }}>
            {isProposer ? (
              <button
                onClick={handleCancel}
                style={{
                  flex: 1, padding: '12px 0', borderRadius: 10,
                  border: `1px solid #EF444460`, background: 'transparent',
                  color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            ) : (
              <>
                <button
                  onClick={handleDecline}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10,
                    border: `1px solid #EF444460`, background: 'transparent',
                    color: '#EF4444', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Decline
                </button>
                <button
                  onClick={handleAccept}
                  style={{
                    flex: 1, padding: '12px 0', borderRadius: 10,
                    border: 'none', background: '#22C55E',
                    color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Accept
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes tradeOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tradePopIn {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  )
}
