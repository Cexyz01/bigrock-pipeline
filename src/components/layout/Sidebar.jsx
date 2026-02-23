import { useState } from 'react'
import { isStaff } from '../../lib/constants'
import { IconHome, IconFilm, IconClipboard, IconLayout, IconBarChart, IconUsers, IconBell, IconCalendar, IconUser, IconLogOut } from '../ui/Icons'
import NavBtn from '../ui/NavBtn'
import Av from '../ui/Av'
import CalendarPopup from '../pages/CalendarPopup'

const RAIL_W = 72
const EXPANDED_W = 230

export default function Sidebar({ user, view, setView, onSignOut, events, onCreateEvent, onDeleteEvent, requestConfirm, unreadCount }) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [hovered, setHovered] = useState(false)
  const staff = isStaff(user.role)

  const mainNav = [
    { id: 'overview', icon: <IconHome size={20} />, label: 'Overview' },
    { id: 'shots', icon: <IconFilm size={20} />, label: 'Shots' },
    { id: 'tasks', icon: <IconClipboard size={20} />, label: 'Tasks' },
    { id: 'storyboard', icon: <IconLayout size={20} />, label: 'Storyboard' },
  ]
  if (staff) mainNav.push({ id: 'activity', icon: <IconBarChart size={20} />, label: 'Attivita' })

  return (
    <>
      {/* Spacer — reserves 72px in the document flow so content doesn't shift */}
      <div style={{ width: RAIL_W, flexShrink: 0 }} />

      {/* Sidebar — fixed position, overlays content on hover */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setShowCalendar(false) }}
        style={{
          position: 'fixed', left: 0, top: 0, bottom: 0,
          width: hovered ? EXPANDED_W : RAIL_W,
          background: '#fff', borderRight: '1px solid #E8ECF1',
          display: 'flex', flexDirection: 'column',
          transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 30,
          overflow: 'hidden',
        }}
      >
        {/* Logo — icon pinned in 72px rail */}
        <div style={{ height: 68, display: 'flex', alignItems: 'center', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ width: RAIL_W, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #6C5CE7, #A29BFE)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 800, color: '#fff',
            }}>BR</div>
          </div>
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>BigRock</div>
            <div style={{ fontSize: 10, color: '#94A3B8' }}>Pipeline</div>
          </div>
        </div>

        {/* Notifications */}
        <div style={{ paddingTop: 8 }}>
          <NavBtn icon={<IconBell size={20} />} label="Notifiche" active={view === 'notifications'} onClick={() => setView('notifications')} badge={unreadCount} />
        </div>

        {/* Main Nav */}
        <div style={{ padding: '8px 0', flex: 1 }}>
          {mainNav.map(n => (
            <NavBtn key={n.id} icon={n.icon} label={n.label} active={view === n.id} onClick={() => setView(n.id)} />
          ))}
        </div>

        {/* Bottom: Calendar, Crew, User */}
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '8px 0' }}>
          <div style={{ position: 'relative' }}>
            <NavBtn icon={<IconCalendar size={20} />} label="Calendario" active={showCalendar} onClick={() => setShowCalendar(!showCalendar)} />
            {showCalendar && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} onClick={() => setShowCalendar(false)} />
                <div style={{
                  position: 'fixed', bottom: 80, left: (hovered ? EXPANDED_W : RAIL_W) + 10, width: 420,
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

          <NavBtn icon={<IconUsers size={20} />} label="Crew" active={view === 'crew'} onClick={() => setView('crew')} />

          {/* User area */}
          <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 4, padding: '8px 0 12px' }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', height: 44,
                cursor: 'pointer', transition: 'background 0.15s ease',
              }}
              onClick={() => setView('profile')}
              onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ width: RAIL_W, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Av name={user.full_name} size={30} url={user.avatar_url} mood={user.mood_emoji} />
              </div>
              <div style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                <div style={{ fontSize: 12, fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', color: '#1a1a2e' }}>{user.full_name}</div>
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{user.role}</div>
              </div>
            </div>

            {/* Sign out — only visible when expanded */}
            <div style={{ overflow: 'hidden', maxHeight: hovered ? 40 : 0, transition: 'max-height 0.25s ease', padding: '0 12px' }}>
              <button onClick={onSignOut}
                style={{ width: '100%', background: '#F8FAFC', border: '1px solid #E8ECF1', borderRadius: 8, padding: '6px 0', color: '#94A3B8', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s ease', marginTop: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                onMouseLeave={e => e.currentTarget.style.background = '#F8FAFC'}
              >
                <IconLogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
