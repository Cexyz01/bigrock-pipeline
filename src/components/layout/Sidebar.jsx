import { useState } from 'react'
import { isStaff } from '../../lib/constants'
import NavBtn from '../ui/NavBtn'
import Av from '../ui/Av'
import CalendarPopup from '../pages/CalendarPopup'

export default function Sidebar({ user, view, setView, onSignOut, events, onCreateEvent, onDeleteEvent, requestConfirm, unreadCount }) {
  const [showCalendar, setShowCalendar] = useState(false)
  const staff = isStaff(user.role)

  // #1: Profile removed from mainNav — accessible only by clicking user name below
  const mainNav = [
    { id: 'overview', icon: '🏠', label: 'Overview' },
    { id: 'shots', icon: '🎬', label: 'Shots' },
    { id: 'tasks', icon: '📋', label: 'Tasks' },
    { id: 'storyboard', icon: '🗂', label: 'Storyboard' },
  ]

  if (staff) {
    mainNav.push({ id: 'activity', icon: '📊', label: 'Attività' })
  }

  return (
    <div style={{
      width: 240, background: '#0d0d16', borderRight: '1px solid #1e1e2e',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'sticky', top: 0, height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 18px 20px', borderBottom: '1px solid #1e1e2e' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 12,
            background: 'linear-gradient(135deg, #CDFF00, #a8d600)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#09090f',
          }}>BR</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f5' }}>BigRock Studios</div>
            <div style={{ fontSize: 11, color: '#555' }}>Production Pipeline</div>
          </div>
        </div>
      </div>

      {/* Notifications link — #5: top-left prominent position */}
      <div style={{ padding: '10px 10px 0' }}>
        <NavBtn icon="🔔" label="Notifiche" active={view === 'notifications'} onClick={() => setView('notifications')} badge={unreadCount} />
      </div>

      {/* Main Nav */}
      <div style={{ padding: '10px 0', flex: 1 }}>
        {mainNav.map(n => (
          <NavBtn key={n.id} icon={n.icon} label={n.label} active={view === n.id} onClick={() => setView(n.id)} />
        ))}
      </div>

      {/* Bottom section: Calendar, Crew, User */}
      <div style={{ borderTop: '1px solid #1e1e2e' }}>
        {/* Calendar popup trigger — #3: fixed z-index */}
        <div style={{ position: 'relative' }}>
          <NavBtn icon="📅" label="Calendario" active={showCalendar} onClick={() => setShowCalendar(!showCalendar)} />
          {showCalendar && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} onClick={() => setShowCalendar(false)} />
              <div style={{
                position: 'fixed', bottom: 80, left: 250, width: 440,
                background: '#141420', border: '1px solid #1e1e2e', borderRadius: 22,
                boxShadow: '0 16px 60px rgba(0,0,0,0.7)', zIndex: 1000,
                maxHeight: '70vh', overflowY: 'auto', padding: 24,
                animation: 'fadeIn 0.15s ease',
              }}>
                <CalendarPopup events={events} user={user} onCreate={onCreateEvent} onDelete={onDeleteEvent} requestConfirm={requestConfirm} />
              </div>
            </>
          )}
        </div>

        {/* Crew */}
        <NavBtn icon="👥" label="Crew" active={view === 'crew'} onClick={() => setView('crew')} />

        {/* User — #1: clicking name opens profile */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid #1e1e2e' }}>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderRadius: 12, padding: '6px 8px', margin: '-6px -8px', transition: 'background 0.15s ease' }}
            onClick={() => setView('profile')}
            onMouseEnter={e => e.currentTarget.style.background = '#1a1a2a'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Av name={user.full_name} size={30} url={user.avatar_url} mood={user.mood_emoji} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#f0f0f5' }}>{user.full_name}</div>
              {/* #2: no mood emoji next to role — #7: no department for staff */}
              <div style={{ fontSize: 10, color: '#555' }}>{user.role}</div>
            </div>
          </div>
          <button onClick={onSignOut}
            style={{ marginTop: 10, width: '100%', background: '#141420', border: '1px solid #1e1e2e', borderRadius: 12, padding: '7px 0', color: '#888', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s ease' }}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
