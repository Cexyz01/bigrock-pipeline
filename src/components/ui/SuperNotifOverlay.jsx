import { useState, useEffect } from 'react'
import { ACCENT } from '../../lib/constants'
import Av from './Av'

const TIMER_SECONDS = 5

export default function SuperNotifOverlay({ notification, onDismiss }) {
  const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS)

  useEffect(() => {
    if (secondsLeft <= 0) return
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft])

  if (!notification) return null

  const sender = notification.sender
  const canDismiss = secondsLeft <= 0

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '36px 32px 28px',
        maxWidth: 440, width: '90%', textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
        animation: 'scaleIn 0.3s ease',
      }}>
        {/* Bell icon */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: ACCENT + '15',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 28,
        }}>
          🔔
        </div>

        <div style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>
          Messaggio importante
        </div>

        {/* Sender */}
        {sender && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
            <Av name={sender.full_name} size={22} url={sender.avatar_url} />
            <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>da {sender.full_name}</span>
          </div>
        )}

        {/* Message */}
        <div style={{
          background: '#F8FAFC', borderRadius: 12, padding: '16px 20px',
          fontSize: 15, lineHeight: 1.6, color: '#1a1a1a', fontWeight: 500,
          textAlign: 'left', marginBottom: 24,
          border: '1px solid #E8ECF1',
        }}>
          {notification.message}
        </div>

        {/* Timer / button */}
        <button
          onClick={canDismiss ? onDismiss : undefined}
          disabled={!canDismiss}
          style={{
            width: '100%', padding: '12px 0', borderRadius: 12, border: 'none',
            fontSize: 15, fontWeight: 700, cursor: canDismiss ? 'pointer' : 'default',
            background: canDismiss ? '#10B981' : '#E8ECF1',
            color: canDismiss ? '#fff' : '#94A3B8',
            transition: 'all 0.3s ease',
          }}
        >
          {canDismiss ? 'Continua' : `Attendi ${secondsLeft}s...`}
        </button>
      </div>
    </div>
  )
}
