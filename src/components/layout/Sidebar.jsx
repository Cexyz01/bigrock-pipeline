import { useState } from 'react'
import { isStaff } from '../../lib/constants'
import NavBtn from '../ui/NavBtn'
import Av from '../ui/Av'
import CalendarPopup from '../pages/CalendarPopup'

export default function Sidebar({ user, view, setView, onSignOut, events, onCreateEvent, onDeleteEvent, requestConfirm }) {
  const [showCalendar, setShowCalendar] = useState(false)
  const staff = isStaff(user.role)

  const mainNav = [
    { id: 'overview', icon: '🏠', label: 'Overview' },
    { id: 'shots', icon: '🎬', label: 'Shots' },
    { id: 'tasks', icon: '📋', label: 'Tasks' },
    { id: 'storyboard', icon: '🗂', label: 'Storyboard' },
    { id: 'profile', icon: '👤', label: 'Profilo' },
  ]

  if (staff) {
    mainNav.push({ id: 'activity', icon: '📊', label: 'Attività' })
  }

  return (
    <div style={{
      width: 240, background: '#111118', borderRight: '1px solid #1c1c26',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'sticky', top: 0, height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '22px 18px 20px', borderBottom: '1px solid #1c1c26' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6ea8fe, #b07ce8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#fff',
          }}>BR</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700 }}>BigRock Studios</div>
            <div style={{ fontSize: 11, color: '#555' }}>Production Pipeline</div>
          </div>
        </div>
      </div>

      {/* Main Nav */}
      <div style={{ padding: '14px 0', flex: 1 }}>
        {mainNav.map(n => (
          <NavBtn key={n.id} icon={n.icon} label={n.label} active={view === n.id} onClick={() => setView(n.id)} />
        ))}
      </div>

      {/* Bottom section: Calendar, Crew, User */}
      <div style={{ borderTop: '1px solid #1c1c26' }}>
        {/* Calendar popup trigger */}
        <div style={{ position: 'relative' }}>
          <NavBtn icon="📅" label="Calendario" active={showCalendar} onClick={() => setShowCalendar(!showCalendar)} />
          {showCalendar && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowCalendar(false)} />
              <div style={{
                position: 'fixed', bottom: 80, left: 250, width: 440,
                background: '#15151e', border: '1px solid #2a2a3a', borderRadius: 16,
                boxShadow: '0 12px 48px rgba(0,0,0,0.5)', zIndex: 100,
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

        {/* User */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid #1c1c26' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Av name={user.full_name} size={30} url={user.avatar_url} mood={user.mood_emoji} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.full_name}</div>
              <div style={{ fontSize: 10, color: '#555' }}>{user.role}{user.mood_emoji ? ` ${user.mood_emoji}` : ''}</div>
            </div>
          </div>
          <button onClick={onSignOut}
            style={{ marginTop: 10, width: '100%', background: '#1e1e2a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '7px 0', color: '#888', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s ease' }}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
