import Fade from '../ui/Fade'
import Btn from '../ui/Btn'

export default function NotificationsPanel({ notifications, onMarkRead, onMarkAllRead, onNavigate }) {
  const unread = notifications.filter(n => !n.read)

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px', color: '#f0f0f5' }}>🔔 Notifiche</h1>
            <p style={{ fontSize: 14, color: '#555' }}>{unread.length > 0 ? `${unread.length} non lette` : 'Tutte lette'}</p>
          </div>
          {unread.length > 0 && (
            <Btn variant="primary" onClick={onMarkAllRead} style={{ fontSize: 12, padding: '8px 16px' }}>Segna tutte lette</Btn>
          )}
        </div>
      </Fade>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#555', fontSize: 14 }}>Nessuna notifica</div>
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
                  padding: '16px 20px', borderRadius: 16, cursor: 'pointer',
                  background: n.read ? '#141420' : 'rgba(205,255,0,0.04)',
                  border: `1px solid ${n.read ? '#1e1e2e' : 'rgba(205,255,0,0.12)'}`,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#1a1a2a'}
                onMouseLeave={e => e.currentTarget.style.background = n.read ? '#141420' : 'rgba(205,255,0,0.04)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#CDFF00', flexShrink: 0 }} />}
                  <span style={{ fontSize: 14, fontWeight: n.read ? 400 : 600, color: '#f0f0f5' }}>{n.title}</span>
                </div>
                {n.body && <div style={{ fontSize: 13, color: '#777', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
                <div style={{ fontSize: 11, color: '#444', marginTop: 8 }}>{new Date(n.created_at).toLocaleString('it')}</div>
              </div>
            </Fade>
          ))
        )}
      </div>
    </div>
  )
}
