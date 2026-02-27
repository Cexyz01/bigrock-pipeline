import { useState } from 'react'
import { signInWithGoogle } from '../../lib/supabase'
import useIsMobile from '../../hooks/useIsMobile'
import Btn from '../ui/Btn'

export default function LoginPage() {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(false)
  const handleLogin = async () => {
    setLoading(true)
    await signInWithGoogle()
    setLoading(false)
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F2F5', padding: isMobile ? 16 : 0 }}>
      <div style={{
        textAlign: 'center', background: '#fff', borderRadius: 24,
        padding: isMobile ? '36px 24px' : '48px 40px', border: '1px solid #E8ECF1',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        minWidth: isMobile ? 'auto' : 360, width: isMobile ? '100%' : 'auto',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24, margin: '0 auto 28px',
          background: 'linear-gradient(135deg, #6C5CE7, #A29BFE)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 800, color: '#fff',
        }}>BR</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 10, color: '#1a1a2e' }}>BigRock Hub</h1>
        <p style={{ fontSize: 14, color: '#64748B', marginBottom: 36 }}>Production Pipeline</p>
        <Btn variant="primary" onClick={handleLogin} loading={loading} style={{ padding: '15px 40px', fontSize: 15, borderRadius: 20 }}>
          Sign in with Google
        </Btn>
        <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 20 }}>Use your @bigrock.it email</p>
      </div>
    </div>
  )
}
