import { useState, useEffect, useRef, useCallback } from 'react'
import {
  acceptTradeInvite, declineTradeInvite, cancelTrade,
  subscribeToTradeSession, supabase,
} from '../../lib/supabase'

const INVITE_TIMEOUT = 15 // seconds (matches game invites)

export default function TradeInviteOverlay({ tradeId, trade, role, onAccepted, onClose, addToast }) {
  const [countdown, setCountdown] = useState(INVITE_TIMEOUT)
  const [status, setStatus] = useState('waiting') // waiting | accepted | declined | cancelled | timeout
  const closedRef = useRef(false)
  const subRef = useRef(null)

  const isProposer = role === 'proposer'
  const otherUser = isProposer ? trade?.target : trade?.proposer
  const otherName = otherUser?.full_name || 'Player'

  const doClose = useCallback((msg) => {
    if (closedRef.current) return
    closedRef.current = true
    if (msg && addToast) addToast(msg, 'info')
    if (subRef.current) {
      supabase.removeChannel(subRef.current)
      subRef.current = null
    }
    onClose()
  }, [onClose, addToast])

  // Subscribe to trade status changes
  useEffect(() => {
    if (!tradeId) return
    subRef.current = subscribeToTradeSession(tradeId, (payload) => {
      const updated = payload.new
      if (updated.status === 'active') {
        setStatus('accepted')
        setTimeout(() => {
          if (!closedRef.current) { closedRef.current = true; onAccepted(tradeId) }
        }, 400)
      } else if (updated.status === 'rejected') {
        setStatus('declined')
        setTimeout(() => doClose(`${otherName} ha rifiutato lo scambio`), 1500)
      } else if (updated.status === 'cancelled') {
        setStatus('cancelled')
        setTimeout(() => doClose('Scambio annullato'), 1000)
      }
    })
    return () => { if (subRef.current) supabase.removeChannel(subRef.current) }
  }, [tradeId, onAccepted, doClose, otherName])

  // Countdown timer
  useEffect(() => {
    if (status !== 'waiting') return
    const iv = setInterval(() => {
      setCountdown(p => {
        if (p <= 1) {
          clearInterval(iv)
          cancelTrade(tradeId)
          setStatus('timeout')
          setTimeout(() => doClose('Tempo scaduto'), 1000)
          return 0
        }
        return p - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [status, tradeId, doClose])

  const handleAccept = async () => {
    const { error } = await acceptTradeInvite(tradeId)
    if (error) addToast?.('Errore nell\'accettare lo scambio', 'error')
  }

  const handleDecline = async () => {
    await declineTradeInvite(tradeId)
  }

  const handleCancel = async () => {
    await cancelTrade(tradeId)
  }

  const exitAnim = status === 'accepted' || status === 'declined' || status === 'cancelled' || status === 'timeout'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.8)',
      backdropFilter: 'blur(8px)',
      animation: 'tradeOverlayIn 0.3s ease',
      opacity: exitAnim ? 0.5 : 1,
      transition: 'opacity 0.3s ease',
    }}>
      <div style={{
        background: '#1a1a1a', borderRadius: 20, padding: '36px 48px',
        minWidth: 320, maxWidth: 420, textAlign: 'center',
        border: '1px solid #333',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        animation: 'tradePopIn 0.3s ease',
        transform: exitAnim ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.3s ease',
      }}>
        {/* Trade icon */}
        <div style={{ fontSize: 56, marginBottom: 12 }}>🔄</div>

        {/* Title */}
        <div style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', marginBottom: 6 }}>
          {role === 'target' ? `${otherName} ti invita!` : `Scambio inviato a ${otherName}`}
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 16, color: '#F28C28', fontWeight: 600, marginBottom: 20 }}>
          Scambio Carte
        </div>

        {/* Status message */}
        <div style={{ fontSize: 14, color: '#888', marginBottom: 20 }}>
          {status === 'waiting' && role === 'proposer' && 'Attesa risposta...'}
          {status === 'waiting' && role === 'target' && 'Vuoi accettare lo scambio?'}
          {status === 'accepted' && '✅ Scambio accettato!'}
          {status === 'declined' && '❌ Scambio rifiutato'}
          {status === 'cancelled' && '⚠️ Scambio annullato'}
          {status === 'timeout' && '⏰ Tempo scaduto'}
        </div>

        {/* Countdown bar */}
        {status === 'waiting' && (
          <div style={{
            height: 4, borderRadius: 2, background: '#2a2a2a',
            marginBottom: 24, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: countdown <= 3 ? '#EF4444' : '#F28C28',
              width: `${(countdown / INVITE_TIMEOUT) * 100}%`,
              transition: 'width 1s linear, background 0.3s ease',
            }} />
          </div>
        )}

        {/* Countdown number */}
        {status === 'waiting' && (
          <div style={{
            fontSize: 32, fontWeight: 900, fontFamily: '"Courier New", monospace',
            color: countdown <= 3 ? '#EF4444' : '#F28C28',
            marginBottom: 24,
            animation: countdown <= 3 ? 'pulse 0.5s ease infinite' : 'none',
          }}>
            {countdown}
          </div>
        )}

        {/* Buttons */}
        {status === 'waiting' && role === 'target' && (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button onClick={handleAccept} style={{
              padding: '10px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
              background: '#22C55E', color: '#fff', border: 'none', cursor: 'pointer',
            }}>
              Accetta
            </button>
            <button onClick={handleDecline} style={{
              padding: '10px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
              background: '#333', color: '#aaa', border: '1px solid #444', cursor: 'pointer',
            }}>
              Rifiuta
            </button>
          </div>
        )}

        {status === 'waiting' && role === 'proposer' && (
          <button onClick={handleCancel} style={{
            padding: '10px 28px', borderRadius: 10, fontSize: 15, fontWeight: 700,
            background: '#333', color: '#aaa', border: '1px solid #444', cursor: 'pointer',
          }}>
            Annulla
          </button>
        )}
      </div>
    </div>
  )
}
