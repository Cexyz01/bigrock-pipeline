import { useEffect, useState } from 'react'

export default function BroadcastOverlay({ message, onDismiss }) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setEntered(true))
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 400,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
    }}>
      <div style={{
        fontSize: 52,
        fontWeight: 800,
        color: '#fff',
        textAlign: 'center',
        maxWidth: '80%',
        padding: 40,
        textShadow: '0 0 40px rgba(108,92,231,0.8), 0 0 80px rgba(108,92,231,0.4)',
        animation: 'broadcastIn 0.5s ease forwards',
        lineHeight: 1.3,
      }}>
        {message}
      </div>

      {/* Progress bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 4,
        background: 'rgba(255,255,255,0.1)',
      }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, #6C5CE7, #A29BFE)',
          width: entered ? '0%' : '100%',
          transition: 'width 5s linear',
        }} />
      </div>
    </div>
  )
}
