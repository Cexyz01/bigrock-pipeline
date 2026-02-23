import Av from '../ui/Av'

export default function NotificationsPanel({ notifications, onMarkRead, onMarkAllRead, onNavigate, onClose }) {
  const unread = notifications.filter(n => !n.read)
  return (
    <div style={{
      position: 'absolute', top: 52, right: 0, width: 400,
      background: '#15151e', border: '1px solid #2a2a3a', borderRadius: 16,
      boxShadow: '0 12px 48px rgba(0,0,0,0.5)', zIndex: 50, overflow: 'hidden',
      animation: 'fadeIn 0.15s ease',
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1e1e2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>Notifiche</span>
        {unread.length > 0 && (
          <button onClick={onMarkAllRead} style={{ background: 'none', border: 'none', color: '#6ea8fe', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Segna tutte lette</button>
        )}
      </div>
      <div style={{ maxHeight: 400, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#555', fontSize: 13 }}>Nessuna notifica</div>
        ) : (
          notifications.slice(0, 25).map(n => (
            <div key={n.id}
              onClick={() => {
                onMarkRead(n.id)
                if (n.link_type && n.link_id) {
                  onNavigate(n.link_type === 'task' ? 'tasks' : n.link_type === 'shot' ? 'shots' : 'overview', n.link_id)
                }
                onClose()
              }}
              style={{
                padding: '14px 20px', borderBottom: '1px solid #1a1a24', cursor: 'pointer',
                background: n.read ? 'transparent' : '#6ea8fe08',
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#1a1a28'}
              onMouseLeave={e => e.currentTarget.style.background = n.read ? 'transparent' : '#6ea8fe08'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                {!n.read && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6ea8fe', flexShrink: 0 }} />}
                <span style={{ fontSize: 13, fontWeight: n.read ? 400 : 600 }}>{n.title}</span>
              </div>
              {n.body && <div style={{ fontSize: 12, color: '#777', marginTop: 2, lineHeight: 1.4 }}>{n.body}</div>}
              <div style={{ fontSize: 11, color: '#444', marginTop: 6 }}>{new Date(n.created_at).toLocaleString('it')}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
