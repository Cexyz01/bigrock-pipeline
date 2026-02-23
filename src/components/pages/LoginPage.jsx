import { useState } from 'react'
import { signInWithGoogle } from '../../lib/supabase'
import Btn from '../ui/Btn'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const handleLogin = async () => {
    setLoading(true)
    await signInWithGoogle()
    setLoading(false)
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 80, height: 80, borderRadius: 24, margin: '0 auto 28px',
          background: 'linear-gradient(135deg, #C5B3E6, #A8E6CF)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, fontWeight: 800, color: '#0f0f1a',
        }}>BR</div>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 10, color: '#EEEEF5' }}>BigRock Studios</h1>
        <p style={{ fontSize: 14, color: '#606080', marginBottom: 36 }}>Production Pipeline</p>
        <Btn variant="primary" onClick={handleLogin} loading={loading} style={{ padding: '15px 40px', fontSize: 15, borderRadius: 20 }}>
          Sign in with Google
        </Btn>
        <p style={{ fontSize: 12, color: '#606080', marginTop: 20 }}>Usa la tua email @bigrock.it</p>
      </div>
    </div>
  )
}
