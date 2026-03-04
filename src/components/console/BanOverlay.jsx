import { useState, useEffect } from 'react'

export default function BanOverlay({ seconds, onExpire }) {
  const [remaining, setRemaining] = useState(seconds)

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          onExpire()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 500,
      background: 'rgba(0,0,0,0.95)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'not-allowed',
      userSelect: 'none',
    }}>
      {/* Skull icon */}
      <div style={{ fontSize: 80, marginBottom: 16 }}>
        &#9760;
      </div>

      {/* Main text */}
      <div style={{
        fontSize: 56,
        fontWeight: 900,
        color: '#EF4444',
        textShadow: '0 0 60px rgba(239,68,68,0.6), 0 0 120px rgba(239,68,68,0.3)',
        animation: 'pulse 1s ease infinite',
        textAlign: 'center',
        letterSpacing: 4,
      }}>
        SEI STATO BANNATO!
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: 18,
        color: '#94A3B8',
        marginTop: 24,
        letterSpacing: 1,
      }}>
        Tornerai tra...
      </div>

      {/* Countdown */}
      <div style={{
        fontSize: 120,
        fontWeight: 900,
        color: '#fff',
        fontFamily: "'Cascadia Code', 'Fira Code', 'Consolas', monospace",
        marginTop: 8,
        textShadow: '0 0 40px rgba(255,255,255,0.3)',
        lineHeight: 1,
      }}>
        {remaining}
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        bottom: 40,
        left: '20%',
        right: '20%',
        height: 6,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #EF4444, #DC2626)',
          width: `${(remaining / seconds) * 100}%`,
          transition: 'width 1s linear',
          borderRadius: 3,
        }} />
      </div>
    </div>
  )
}
