import { useState } from 'react'
import { isStaff } from '../../lib/constants'
import { IconHome, IconFilm, IconClipboard, IconLayout, IconBarChart, IconUsers, IconBell, IconCalendar, IconLogOut } from '../ui/Icons'
import NavBtn from '../ui/NavBtn'
import Av from '../ui/Av'
import Btn from '../ui/Btn'
import CalendarPopup from '../pages/CalendarPopup'
import houstonLogo from '../../../Images/houston.png'
import packIcon from '../../../Images/pack-bigrock.png'

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
  const [packHover, setPackHover] = useState(false)
  const [packPressed, setPackPressed] = useState(false)
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
        <div style={{ height: 68, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid #F1F5F9', overflow: 'hidden' }}>
          <img
            src={houstonLogo}
            alt="Houston Pipeline"
            style={{
              height: 38,
              width: 'auto',
              objectFit: 'contain',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              ...(hovered ? { height: 32, maxWidth: EXPANDED_W - 32 } : { height: 38, maxWidth: RAIL_W - 16 }),
            }}
          />
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
                position: 'fixed', top: 80, left: (hovered ? EXPANDED_W : RAIL_W) + 10, width: 380,
                background: '#fff', border: '1px solid #E8ECF1', borderRadius: 16,
                boxShadow: '0 16px 48px rgba(0,0,0,0.10)', zIndex: 1000,
                maxHeight: '70vh', display: 'flex', flexDirection: 'column',
                animation: 'scaleIn 0.15s ease',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>Notifiche</span>
                    {unreadCount > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#6C5CE7', color: '#fff', padding: '2px 7px', borderRadius: 8, minWidth: 18, textAlign: 'center' }}>{unreadCount}</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={onMarkAllRead}
                      style={{ fontSize: 11, color: '#6C5CE7', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 4px' }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >Segna tutte lette</button>
                  )}
                </div>
                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
                  {(!notifications || notifications.length === 0) ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Nessuna notifica</div>
                  ) : notifications.slice(0, 30).map(n => {
                    const date = new Date(n.created_at)
                    const isToday = new Date().toDateString() === date.toDateString()
                    const timeStr = date.toLocaleTimeString('it', { hour: '2-digit', minute: '2-digit' })
                    const dateStr = isToday ? timeStr : `${date.toLocaleDateString('it', { day: 'numeric', month: 'short' })} ${timeStr}`
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                          padding: '10px 20px', cursor: 'pointer',
                          borderLeft: !n.read ? '3px solid #6C5CE7' : '3px solid transparent',
                          background: !n.read ? 'rgba(108,92,231,0.04)' : 'transparent',
                          transition: 'background 0.1s ease',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = !n.read ? 'rgba(108,92,231,0.08)' : '#F8FAFC'}
                        onMouseLeave={e => e.currentTarget.style.background = !n.read ? 'rgba(108,92,231,0.04)' : 'transparent'}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: n.read ? 400 : 600, color: '#1a1a2e', lineHeight: 1.3 }}>{n.title}</div>
                          {n.body && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.body}</div>}
                        </div>
                        <span style={{ fontSize: 10, color: '#B0B8C4', whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2 }}>{dateStr}</span>
                      </div>
                    )
                  })}
                </div>
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

        {/* Pack Section */}
        <div style={{ borderTop: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9', padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', borderRadius: 12,
              width: hovered ? Math.round(EXPANDED_W * 0.6) : RAIL_W - 20,
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              overflow: 'hidden',
              transform: packPressed ? 'scale(0.93)' : packHover ? 'scale(1.05)' : 'scale(1)',
              opacity: packPressed ? 0.85 : packHover ? 1 : 0.9,
              userSelect: 'none', WebkitUserDrag: 'none',
            }}
            onClick={() => setView('pack')}
            onMouseEnter={() => setPackHover(true)}
            onMouseLeave={() => { setPackHover(false); setPackPressed(false) }}
            onMouseDown={() => setPackPressed(true)}
            onMouseUp={() => setPackPressed(false)}
          >
            <img
              src={packIcon}
              alt="Pack"
              draggable={false}
              style={{
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
                borderRadius: 12,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                pointerEvents: 'none',
              }}
            />
          </div>
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
