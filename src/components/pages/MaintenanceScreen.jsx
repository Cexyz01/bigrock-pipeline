import { ACCENT } from '../../lib/constants'

export default function MaintenanceScreen({ onSignOut }) {
  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #F0F2F5 0%, #E8ECF1 100%)', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '48px 40px', maxWidth: 460, width: '100%',
        boxShadow: '0 12px 40px rgba(0,0,0,0.08)', textAlign: 'center',
      }}>
        <img src="/icons/icon-app.png" alt="BigRockHub" style={{
          width: 64, height: 64, borderRadius: 16, margin: '0 auto 24px',
        }} />
        <div style={{
          display: 'inline-block', fontSize: 11, fontWeight: 700, color: ACCENT,
          background: `${ACCENT}15`, padding: '5px 12px', borderRadius: 999,
          textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 18,
        }}>
          Maintenance
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1a1a1a', margin: '0 0 12px' }}>
          We'll be right back
        </h1>
        <p style={{ fontSize: 14, color: '#64748B', lineHeight: 1.6, margin: '0 0 14px' }}>
          BigRockHub is undergoing scheduled maintenance.
          We're working to bring it back online as soon as possible —
          thank you for your patience.
        </p>
        <p style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.5, margin: '0 0 28px' }}>
          This page will reload automatically as soon as the site is back.
        </p>
        {onSignOut && (
          <button onClick={onSignOut} style={{
            background: 'transparent', border: '1px solid #E8ECF1', color: '#64748B',
            padding: '8px 18px', borderRadius: 10, fontSize: 12, fontWeight: 600,
            cursor: 'pointer',
          }}>
            Sign out
          </button>
        )}
      </div>
    </div>
  )
}
