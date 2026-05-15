import { useState, useEffect } from 'react'
import { signInWithGoogle } from '../../lib/supabase'
import useIsMobile from '../../hooks/useIsMobile'
import Btn from '../ui/Btn'

export default function LoginPage() {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
  // Hidden by default — Ctrl+Shift+D (Cmd+Shift+D on Mac) toggles it. There
  // is no role gate here on purpose: the LoginPage runs before any user has
  // signed in, so we can't check admin status. Security through obscurity
  // is enough for this escape hatch since it only wipes the local browser's
  // state for this origin (no server-side effects). Esc hides it.
  const [showReset, setShowReset] = useState(false)
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault()
        setShowReset(s => !s)
      } else if (e.key === 'Escape') {
        setShowReset(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const handleLogin = async () => {
    setLoading(true)
    await signInWithGoogle()
    setLoading(false)
  }
  const handleHardReset = async () => {
    setResetting(true)
    // Defined in main.jsx — wipes SW, caches, storage, IndexedDB, then reloads.
    if (typeof window.bigrockHardReset === 'function') {
      await window.bigrockHardReset()
    } else {
      window.location.reload()
    }
  }
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5', padding: isMobile ? 16 : 0 }}>
      <div style={{
        textAlign: 'center', background: '#fff', borderRadius: 24,
        padding: isMobile ? '36px 24px' : '48px 40px', border: '1px solid #E8ECF1',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        minWidth: isMobile ? 'auto' : 360, width: isMobile ? '100%' : 'auto',
      }}>
        <img src="/icons/icon-app.png" alt="BigRock Hub" style={{
          width: 80, height: 80, borderRadius: 24, margin: '0 auto 28px',
        }} />
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 10, color: '#1a1a1a' }}>BigRock Hub</h1>
        <p style={{ fontSize: 14, color: '#64748B', marginBottom: 36 }}>Production Pipeline</p>
        <Btn variant="primary" onClick={handleLogin} loading={loading} style={{ padding: '15px 40px', fontSize: 15, borderRadius: 20 }}>
          Sign in with Google
        </Btn>
        <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 20 }}>Use your @bigrock.it email</p>
        {/* Hidden admin escape hatch — only revealed by Ctrl+Shift+D. Wipes
            every browser-side bit of state for this origin and reloads. */}
        {showReset && (
          <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid #F1F5F9' }}>
            <button
              type="button"
              onClick={handleHardReset}
              disabled={resetting}
              style={{
                background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: 8,
                cursor: resetting ? 'wait' : 'pointer',
                fontSize: 12, color: '#92400E', fontWeight: 600,
                padding: '8px 14px', fontFamily: 'inherit',
              }}
              title="Cancella service worker, cache e dati locali, poi ricarica."
            >
              {resetting ? 'Reset in corso…' : '⚠ Reset completo del sito'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
