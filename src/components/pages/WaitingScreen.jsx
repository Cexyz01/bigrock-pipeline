import Av from '../ui/Av'

export default function WaitingScreen({ user, onSignOut }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #F0F2F5 0%, #E8ECF1 100%)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'center' }}>
          <Av user={user} size={80} />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px' }}>
          Ciao, {user.full_name?.split(' ')[0] || 'Studente'}!
        </h1>
        <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.6, margin: '0 0 32px' }}>
          In attesa di assegnazione a un progetto.<br />
          Un professore ti assegnerà presto a un progetto.
        </p>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10, padding: '12px 20px',
          background: '#fff', borderRadius: 12, border: '1px solid #E8ECF1',
          marginBottom: 32,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: '#F59E0B',
            animation: 'pulse 2s ease infinite',
          }} />
          <span style={{ fontSize: 13, color: '#94A3B8' }}>In attesa...</span>
        </div>
        <div>
          <button onClick={onSignOut} style={{
            padding: '10px 24px', borderRadius: 10, border: '1px solid #E8ECF1',
            background: '#fff', color: '#64748B', fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}>
            Esci
          </button>
        </div>
      </div>
    </div>
  )
}
