import { useState } from 'react'
import NotificationsPanel from '../notifications/NotificationsPanel'

export default function TopBar({ viewLabel, viewIcon, notifications, unreadCount, onMarkRead, onMarkAllRead, onNavigate, chatOpen, onToggleChat }) {
  const [showNotif, setShowNotif] = useState(false)

  return (
    <div style={{
      height: 60, borderBottom: '1px solid #1c1c26',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 32px', background: '#0e0e14', position: 'sticky', top: 0, zIndex: 10,
    }}>
      <span style={{ fontSize: 15, fontWeight: 600 }}>{viewIcon} {viewLabel}</span>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Chat toggle */}
        <button onClick={onToggleChat}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: chatOpen ? '#6ea8fe18' : '#1e1e2a',
            border: `1px solid ${chatOpen ? '#6ea8fe30' : '#2a2a3a'}`,
            borderRadius: 10, padding: '8px 16px',
            color: chatOpen ? '#6ea8fe' : '#888',
            fontSize: 13, fontWeight: 600, transition: 'all 0.15s ease',
          }}
        >
          💬 Chat
        </button>

        {/* Notifications */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowNotif(!showNotif)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: unreadCount > 0 ? '#f0707012' : '#1e1e2a',
              border: `1px solid ${unreadCount > 0 ? '#f0707030' : '#2a2a3a'}`,
              borderRadius: 10, padding: '8px 16px',
              color: unreadCount > 0 ? '#f07070' : '#888',
              fontSize: 13, fontWeight: 600, transition: 'all 0.15s ease',
              animation: unreadCount > 0 ? 'bellPulse 2s ease-in-out infinite' : 'none',
            }}
          >
            🔔 {unreadCount > 0 ? `${unreadCount} nuove` : 'Notifiche'}
          </button>
          {showNotif && (
            <NotificationsPanel
              notifications={notifications}
              onMarkRead={onMarkRead}
              onMarkAllRead={onMarkAllRead}
              onNavigate={(view, id) => { onNavigate(view, id); setShowNotif(false) }}
              onClose={() => setShowNotif(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
