import Fade from '../ui/Fade'
import Btn from '../ui/Btn'

export default function NotificationsPanel({ notifications, onMarkRead, onMarkAllRead, onNavigate }) {
  const unread = notifications.filter(n => !n.read)

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 700, margin: '0 0 6px', color: '#EEEEF5' }}>🔔 Notifiche</h1>
            <p style={{ fontSize: 14, color: '#9090B0' }}>{unread.length > 0 ? `${unread.length} non lette` : 'Tutte lette'}</p>
          </div>
          {unread.length > 0 && (
            <Btn variant="primary" onClick={onMarkAllRead} style={{ fontSize: 12, padding: '9px 18px' }}>Segna tutte lette</Btn>
          )}
        </div>
      </Fade>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: 70, textAlign: 'center', color: '#606080', fontSize: 14 }}>Nessuna notifica</div>
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
                  background: n.read ? '#1c1c35' : 'rgba(197,179,230,0.05)',
                  border: `1px solid ${n.read ? 'rgba(255,255,255,0.06)' : 'rgba(197,179,230,0.15)'}`,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#232345'}
                onMouseLeave={e => e.currentTarget.style.background = n.read ? '#1c1c35' : 'rgba(197,179,230,0.05)'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C5B3E6', flexShrink: 0 }} />}
                  <span style={{ fontSize: 14, fontWeight: n.read ? 400 : 600, color: '#EEEEF5' }}>{n.title}</span>
                </div>
                {n.body && <div style={{ fontSize: 13, color: '#9090B0', marginTop: 4, lineHeight: 1.5 }}>{n.body}</div>}
                <div style={{ fontSize: 11, color: '#606080', marginTop: 10 }}>{new Date(n.created_at).toLocaleString('it')}</div>
              </div>
            </Fade>
          ))
        )}
      </div>
    </div>
  )
}
