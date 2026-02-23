import Fade from '../ui/Fade'
import Btn from '../ui/Btn'

export default function NotificationsPanel({ notifications, onMarkRead, onMarkAllRead, onNavigate }) {
  const unread = notifications.filter(n => !n.read)

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 700, margin: '0 0 6px', color: '#1a1a2e' }}>Notifiche</h1>
            <p style={{ fontSize: 14, color: '#64748B' }}>{unread.length > 0 ? `${unread.length} non lette` : 'Tutte lette'}</p>
          </div>
          {unread.length > 0 && (
            <Btn variant="primary" onClick={onMarkAllRead} style={{ fontSize: 12, padding: '9px 18px' }}>Segna tutte lette</Btn>
          )}
        </div>
      </Fade>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: 70, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Nessuna notifica</div>
        ) : (
          notifications.slice(0, 40).map((n, i) => (
            <Fade key={n.id} delay={Math.min(i * 20, 200)}>
              <div
                onClick={() => {
                  onMarkRead(n.id)
                  if (n.link_type && n.link_id) {
                    onNavigate(n.link_type === 'task' ? 'tasks' : n.link_type === 'shot' ? 'shots' : 'overview', n.link_id)
                  }
                }}
                style={{
                  padding: '18px 22px', borderRadius: 20, cursor: 'pointer',
                  background: n.read ? '#F8FAFC' : '#fff',
                  border: `1px solid ${n.read ? '#E8ECF1' : '#E2E8F0'}`,
                  boxShadow: n.read ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = n.read ? '#F8FAFC' : '#fff'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6C5CE7', flexShrink: 0 }} />}
                  <span style={{ fontSize: 14, fontWeight: n.read ? 400 : 600, color: '#1a1a2e' }}>{n.title}</span>
                </div>
                {n.body && <div style={{ fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 1.5 }}>{n.body}</div>}
                <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 10 }}>{new Date(n.created_at).toLocaleString('it')}</div>
              </div>
            </Fade>
          ))
        )}
      </div>
    </div>
  )
}
