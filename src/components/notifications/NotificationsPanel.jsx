import Fade from '../ui/Fade'
import Btn from '../ui/Btn'

// ── Notification category config ──
const NOTIF_CATEGORIES = {
  // WIP updates — blue
  wip_update:     { label: 'WIP',       color: '#0984E3', bg: '#EBF5FB', icon: '🎨' },
  // Task lifecycle — purple
  task_assigned:  { label: 'Assigned',    color: '#6C5CE7', bg: '#F3F0FF', icon: '📋' },
  task_review:    { label: 'Review',      color: '#6C5CE7', bg: '#F3F0FF', icon: '👁' },
  // Approved — green
  task_approved:  { label: 'Approved',    color: '#00B894', bg: '#E8F8F5', icon: '✅' },
  // Revision needed — orange/warning
  task_revision:  { label: 'Revision',    color: '#E17055', bg: '#FFF0ED', icon: '⚠️' },
  // Comments — warm amber
  comment:        { label: 'Comment',     color: '#F39C12', bg: '#FFF8E7', icon: '💬' },
  // DM / private messages — red
  dm:             { label: 'Message',     color: '#D63031', bg: '#FFEDED', icon: '✉️' },
}

const DEFAULT_CAT = { label: 'Notification', color: '#64748B', bg: '#F1F5F9', icon: '🔔' }

function getCat(type) {
  return NOTIF_CATEGORIES[type] || DEFAULT_CAT
}

export default function NotificationsPanel({ notifications, onMarkRead, onMarkAllRead, onNavigate }) {
  const unread = notifications.filter(n => !n.read)

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 6px', color: '#1a1a2e' }}>Notifications</h1>
            <p style={{ fontSize: 14, color: '#64748B' }}>{unread.length > 0 ? `${unread.length} unread` : 'All read'}</p>
          </div>
          {unread.length > 0 && (
            <Btn variant="primary" onClick={onMarkAllRead} style={{ fontSize: 12, padding: '9px 18px' }}>Mark all read</Btn>
          )}
        </div>
      </Fade>

      {/* Category legend */}
      {unread.length > 0 && (
        <Fade delay={40}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {Object.entries(NOTIF_CATEGORIES).map(([key, cat]) => (
              <span key={key} style={{
                fontSize: 10, fontWeight: 600, color: cat.color,
                background: cat.bg, padding: '3px 10px', borderRadius: 6,
                border: `1px solid ${cat.color}20`,
              }}>{cat.icon} {cat.label}</span>
            ))}
          </div>
        </Fade>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {notifications.length === 0 ? (
          <div style={{ padding: 70, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>No notifications</div>
        ) : (
          notifications.slice(0, 40).map((n, i) => {
            const cat = getCat(n.type)
            const isUnread = !n.read

            return (
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
                    background: isUnread ? cat.bg : '#F8FAFC',
                    border: `1.5px solid ${isUnread ? cat.color + '30' : '#E8ECF1'}`,
                    borderLeft: isUnread ? `4px solid ${cat.color}` : '4px solid transparent',
                    boxShadow: isUnread ? `0 2px 8px ${cat.color}10` : 'none',
                    transition: 'all 0.15s ease',
                    opacity: isUnread ? 1 : 0.7,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateX(2px)'
                    e.currentTarget.style.boxShadow = `0 4px 12px ${cat.color}18`
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateX(0)'
                    e.currentTarget.style.boxShadow = isUnread ? `0 2px 8px ${cat.color}10` : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {/* Category icon */}
                    <span style={{
                      fontSize: 18, width: 34, height: 34, borderRadius: 10,
                      background: isUnread ? `${cat.color}15` : '#F1F5F9',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>{cat.icon}</span>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {/* Category pill */}
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: cat.color,
                          background: isUnread ? `${cat.color}15` : '#E8ECF1',
                          padding: '2px 7px', borderRadius: 4,
                          textTransform: 'uppercase', letterSpacing: '0.04em',
                        }}>{cat.label}</span>
                        {/* Unread dot */}
                        {isUnread && <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: cat.color, flexShrink: 0,
                        }} />}
                      </div>
                      <div style={{
                        fontSize: 14, fontWeight: isUnread ? 600 : 400,
                        color: '#1a1a2e', marginTop: 3,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{n.title}</div>
                      {n.body && (
                        <div style={{
                          fontSize: 12, color: '#64748B', marginTop: 2,
                          lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{n.body}</div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div style={{
                      fontSize: 10, color: '#94A3B8', flexShrink: 0,
                      textAlign: 'right', whiteSpace: 'nowrap',
                    }}>
                      {formatRelativeTime(n.created_at)}
                    </div>
                  </div>
                </div>
              </Fade>
            )
          })
        )}
      </div>
    </div>
  )
}

// ── Relative time helper ──
function formatRelativeTime(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMin / 60)
  const diffD = Math.floor(diffH / 24)

  if (diffMin < 1) return 'Now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffH < 24) return `${diffH}h ago`
  if (diffD < 7) return `${diffD}d ago`
  return date.toLocaleDateString('en', { day: 'numeric', month: 'short' })
}
