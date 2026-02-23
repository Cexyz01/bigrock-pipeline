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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090f' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 22, margin: '0 auto 24px',
          background: 'linear-gradient(135deg, #CDFF00, #a8d600)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, fontWeight: 800, color: '#09090f',
        }}>BR</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: '#f0f0f5' }}>BigRock Studios</h1>
        <p style={{ fontSize: 14, color: '#555', marginBottom: 32 }}>Production Pipeline</p>
        <Btn variant="primary" onClick={handleLogin} loading={loading} style={{ padding: '14px 36px', fontSize: 15 }}>
          Sign in with Google
        </Btn>
        <p style={{ fontSize: 12, color: '#444', marginTop: 16 }}>Usa la tua email @bigrock.it</p>
      </div>
    </div>
  )
}
