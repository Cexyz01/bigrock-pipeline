import { useState } from 'react'
import { signInWithGoogle } from '../../lib/supabase'
import useIsMobile from '../../hooks/useIsMobile'
import Btn from '../ui/Btn'

export default function LoginPage() {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(false)
  const [resetting, setResetting] = useState(false)
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
        {/* Safety valve for the "stuck on a poisoned device" scenario — wipes
            every browser-side bit of state for this origin and reloads. */}
        <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid #F1F5F9' }}>
          <button
            type="button"
            onClick={handleHardReset}
            disabled={resetting}
            style={{
              background: 'transparent', border: 'none', cursor: resetting ? 'wait' : 'pointer',
              fontSize: 11, color: '#94A3B8', textDecoration: 'underline',
              padding: 4, fontFamily: 'inherit',
            }}
            title="Cancella service worker, cache e dati locali, poi ricarica."
          >
            {resetting ? 'Reset in corso…' : 'Problemi a entrare? Reset completo del sito'}
          </button>
        </div>
      </div>
    </div>
  )
}
