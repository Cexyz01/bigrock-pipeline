import { useState } from 'react'
import { isStaff } from '../../lib/constants'
import { IconHome, IconFilm, IconClipboard, IconLayout, IconBarChart, IconUsers, IconBell, IconCalendar, IconLogOut } from '../ui/Icons'
import NavBtn from '../ui/NavBtn'
import Av from '../ui/Av'
import Btn from '../ui/Btn'
import CalendarPopup from '../pages/CalendarPopup'

const RAIL_W = 72
const EXPANDED_W = 230

export default function Sidebar({
  user, view, setView, onSignOut,
  events, onCreateEvent, onDeleteEvent,
  notifications, onMarkRead, onMarkAllRead, onNavigate,
  requestConfirm, unreadCount,
}) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [hovered, setHovered] = useState(false)
  const staff = isStaff(user.role)

  const mainNav = [
    { id: 'overview', icon: <IconHome size={20} />, label: 'Overview' },
    { id: 'shots', icon: <IconFilm size={20} />, label: 'Shots' },
    { id: 'tasks', icon: <IconClipboard size={20} />, label: 'Tasks' },
    { id: 'storyboard', icon: <IconLayout size={20} />, label: 'Storyboard' },
  ]
  if (staff) mainNav.push({ id: 'activity', icon: <IconBarChart size={20} />, label: 'Attivita' })

  const closePopups = () => { setShowCalendar(false); setShowNotifs(false) }

  const handleNotifClick = (n) => {
    onMarkRead(n.id)
    if (n.link_type && n.link_id) {
      onNavigate(n.link_type === 'task' ? 'tasks' : n.link_type === 'shot' ? 'shots' : 'overview', n.link_id)
    }
    setShowNotifs(false)
  }

  return (
    <>
      <div style={{ width: RAIL_W, flexShrink: 0 }} />

      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); closePopups() }}
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
        {/* Logo */}
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
        <div style={{ paddingTop: 8, position: 'relative' }}>
          <NavBtn
            icon={<IconBell size={20} />}
            label="Notifiche"
            active={showNotifs}
            onClick={() => { setShowNotifs(!showNotifs); setShowCalendar(false) }}
            badge={unreadCount}
          />
          {showNotifs && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 900 }} onClick={() => setShowNotifs(false)} />
              <div style={{
                position: 'fixed', top: 80, left: (hovered ? EXPANDED_W : RAIL_W) + 10, width: 400,
                background: '#fff', border: '1px solid #E8ECF1', borderRadius: 16,
                boxShadow: '0 16px 48px rgba(0,0,0,0.12)', zIndex: 1000,
                maxHeight: '70vh', overflowY: 'auto', padding: 20,
                animation: 'scaleIn 0.15s ease',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>
                    Notifiche
                    {unreadCount > 0 && <span style={{ fontSize: 12, color: '#6C5CE7', marginLeft: 8 }}>{unreadCount} nuove</span>}
                  </h3>
                  {unreadCount > 0 && (
                    <Btn variant="default" onClick={onMarkAllRead} style={{ fontSize: 11, padding: '4px 10px' }}>Segna tutte lette</Btn>
                  )}
                </div>
                {(!notifications || notifications.length === 0) ? (
                  <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Nessuna notifica</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {notifications.slice(0, 30).map(n => (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        style={{
                          padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                          background: n.read ? '#F8FAFC' : '#fff',
                          border: `1px solid ${n.read ? '#F1F5F9' : '#E2E8F0'}`,
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                        onMouseLeave={e => e.currentTarget.style.background = n.read ? '#F8FAFC' : '#fff'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {!n.read && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6C5CE7', flexShrink: 0 }} />}
                          <span style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: '#1a1a2e' }}>{n.title}</span>
                        </div>
                        {n.body && <div style={{ fontSize: 12, color: '#64748B', marginTop: 3, lineHeight: 1.4 }}>{n.body}</div>}
                        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 6 }}>{new Date(n.created_at).toLocaleString('it')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
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
            <NavBtn icon={<IconCalendar size={20} />} label="Calendario" active={showCalendar} onClick={() => { setShowCalendar(!showCalendar); setShowNotifs(false) }} />
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
