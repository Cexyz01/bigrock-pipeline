import { useState, useEffect } from 'react'
import { IconX, IconPlus } from './Icons'

const DISMISS_KEY = 'pwa-banner-dismissed'

export default function InstallBanner() {
  const [show, setShow] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Already installed as PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    setIsStandalone(standalone)
    if (standalone) return

    // Already dismissed within last 3 days
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000) return
    }

    // Detect iOS Safari
    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome/.test(ua)
    setIsIOS(ios && safari)

    if (ios && safari) {
      setShow(true)
      return
    }

    // Android / Chrome — listen for install prompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice
      if (result.outcome === 'accepted') {
        setShow(false)
      }
      setDeferredPrompt(null)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
    setShow(false)
  }

  if (!show || isStandalone) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
      background: '#1a1a1a',
      borderBottom: '1px solid #2d2d2d',
      padding: '12px 16px',
      animation: 'slideDown 0.3s ease',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    }}>
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* App icon */}
        <img
          src="/icons/icon-app.png"
          alt="BigRock Hub"
          style={{
            width: 48, height: 48, borderRadius: 12,
            flexShrink: 0,
          }}
        />

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', lineHeight: 1.2 }}>BigRock Hub</div>
          {isIOS ? (
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3, lineHeight: 1.4 }}>
              Tocca{' '}
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: '#2d2d2d', borderRadius: 4, padding: '1px 5px', verticalAlign: 'middle',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F28C28" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </span>
              {' '}poi <strong style={{ color: '#F1F5F9' }}>Aggiungi alla Home</strong>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Installa l'app sulla home</div>
          )}
        </div>

        {/* Action */}
        {!isIOS && (
          <button
            onClick={handleInstall}
            style={{
              background: '#F28C28', border: 'none', borderRadius: 10,
              padding: '8px 16px', color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <IconPlus size={14} /> Installa
          </button>
        )}

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          style={{
            background: 'none', border: 'none', color: '#64748B',
            cursor: 'pointer', padding: 4, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <IconX size={18} />
        </button>
      </div>
    </div>
  )
}
