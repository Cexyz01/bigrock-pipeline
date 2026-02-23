import { useState } from 'react'
import { isStaff } from '../../lib/constants'
import { IconHome, IconFilm, IconClipboard, IconLayout, IconBarChart, IconUsers, IconBell, IconCalendar, IconUser, IconLogOut } from '../ui/Icons'
import NavBtn from '../ui/NavBtn'
import Av from '../ui/Av'
import CalendarPopup from '../pages/CalendarPopup'

export default function Sidebar({ user, view, setView, onSignOut, events, onCreateEvent, onDeleteEvent, requestConfirm, unreadCount }) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const staff = isStaff(user.role)

  const mainNav = [
    { id: 'overview', icon: <IconHome size={20} />, label: 'Overview' },
    { id: 'shots', icon: <IconFilm size={20} />, label: 'Shots' },
    { id: 'tasks', icon: <IconClipboard size={20} />, label: 'Tasks' },
    { id: 'storyboard', icon: <IconLayout size={20} />, label: 'Storyboard' },
  ]
  if (staff) mainNav.push({ id: 'activity', icon: <IconBarChart size={20} />, label: 'Attivita' })

  const w = expanded ? 220 : 72

  return (
    <div
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => { setExpanded(false); setShowCalendar(false) }}
      style={{
        width: w, background: '#fff', borderRight: '1px solid #E8ECF1',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: 'sticky', top: 0, height: '100vh',
        transition: 'width 0.2s ease',
        zIndex: 30,
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 0 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #6C5CE7, #A29BFE)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0,
          }}>BR</div>
          {expanded && (
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>BigRock</div>
              <div style={{ fontSize: 10, color: '#94A3B8' }}>Pipeline</div>
            </div>
          )}
        </div>
      </div>

      {/* Notifications */}
      <div style={{ padding: '8px 0 0' }}>
        <NavBtn icon={<IconBell size={20} />} label="Notifiche" active={view === 'notifications'} onClick={() => setView('notifications')} badge={unreadCount} collapsed={!expanded} />
      </div>

      {/* Main Nav */}
      <div style={{ padding: '8px 0', flex: 1 }}>
        {mainNav.map(n => (
          <NavBtn key={n.id} icon={n.icon} label={n.label} active={view === n.id} onClick={() => setView(n.id)} collapsed={!expanded} />
        ))}
      </div>

      {/* Bottom: Calendar, Crew, User */}
      <div style={{ borderTop: '1px solid #F1F5F9', padding: '8px 0' }}>
        <div style={{ position: 'relative' }}>
          <NavBtn icon={<IconCalendar size={20} />} label="Calendario" active={showCalendar} onClick={() => setShowCalendar(!showCalendar)} collapsed={!expanded} />
          {showCalendar && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} onClick={() => setShowCalendar(false)} />
              <div style={{
                position: 'fixed', bottom: 80, left: w + 10, width: 420,
                background: '#fff', border: '1px solid #E8ECF1', borderRadius: 16,
                boxShadow: '0 16px 48px rgba(0,0,0,0.12)', zIndex: 1000,
                maxHeight: '70vh', overflowY: 'auto', padding: 24,
                animation: 'scaleIn 0.15s ease',
              }}>
                <CalendarPopup events={events} user={user} onCreate={onCreateEvent} onDelete={onDeleteEvent} requestConfirm={requestConfirm} />
              </div>
            </>
          )}
        </div>

        <NavBtn icon={<IconUsers size={20} />} label="Crew" active={view === 'crew'} onClick={() => setView('crew')} collapsed={!expanded} />

        {/* User area */}
        <div style={{ padding: '8px 8px 12px', borderTop: '1px solid #F1F5F9', marginTop: 4 }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              borderRadius: 10, padding: '8px', transition: 'background 0.15s ease',
              justifyContent: expanded ? 'flex-start' : 'center',
            }}
            onClick={() => setView('profile')}
            onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <Av name={user.full_name} size={30} url={user.avatar_url} mood={user.mood_emoji} />
            {expanded && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#1a1a2e' }}>{user.full_name}</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{user.role}</div>
              </div>
            )}
          </div>
          {expanded && (
            <button onClick={onSignOut}
              style={{ marginTop: 6, width: '100%', background: '#F8FAFC', border: '1px solid #E8ECF1', borderRadius: 8, padding: '6px 0', color: '#94A3B8', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s ease' }}
              onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
              onMouseLeave={e => e.currentTarget.style.background = '#F8FAFC'}
            >
              <IconLogOut size={14} /> Sign Out
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
