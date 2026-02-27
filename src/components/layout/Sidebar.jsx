import { useState } from 'react'
import { isStaff, isAdmin, displayRole } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'

// ── Notification category colors ──
const NOTIF_CAT = {
  wip_update:    { label: 'WIP',       color: '#0984E3', bg: '#EBF5FB', icon: '🎨' },
  task_assigned: { label: 'Assigned',  color: '#6C5CE7', bg: '#F3F0FF', icon: '📋' },
  task_review:   { label: 'Review',    color: '#6C5CE7', bg: '#F3F0FF', icon: '👁' },
  task_approved: { label: 'Approved',  color: '#00B894', bg: '#E8F8F5', icon: '✅' },
  task_revision: { label: 'Revision',  color: '#E17055', bg: '#FFF0ED', icon: '⚠️' },
  comment:       { label: 'Comment',   color: '#F39C12', bg: '#FFF8E7', icon: '💬' },
  dm:            { label: 'Message',   color: '#D63031', bg: '#FFEDED', icon: '✉️' },
}
const NOTIF_DEFAULT = { label: 'Notification', color: '#64748B', bg: '#F1F5F9', icon: '🔔' }
const getNotifCat = (type) => NOTIF_CAT[type] || NOTIF_DEFAULT
import { IconHome, IconFilm, IconClipboard, IconLayout, IconBarChart, IconUsers, IconBell, IconCalendar, IconLogOut, IconEye } from '../ui/Icons'
import NavBtn from '../ui/NavBtn'
import Av from '../ui/Av'
import Btn from '../ui/Btn'
import CalendarPopup from '../pages/CalendarPopup'
import houstonLogo from '../../../Images/bigrock.png'
import packIcon from '../../../Images/pack-bigrock.png'

const RAIL_W = 72
const EXPANDED_W = 230

export default function Sidebar({
  user, view, setView, onSignOut,
  events, onCreateEvent, onDeleteEvent,
  notifications, onMarkRead, onMarkAllRead, onNavigate,
  requestConfirm, unreadCount, tcgGameActive, reviewCount,
}) {
  const isMobile = useIsMobile()
  const [showCalendar, setShowCalendar] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [packHover, setPackHover] = useState(false)
  const [packPressed, setPackPressed] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const staff = isStaff(user.role)
  const admin = isAdmin(user.role)

  // TCG visible: admins always, others only when game is active
  const showTcg = admin || tcgGameActive

  const mainNav = [
    { id: 'overview', icon: <IconHome size={20} />, label: 'Overview' },
    { id: 'shots', icon: <IconFilm size={20} />, label: 'Shots' },
    { id: 'tasks', icon: <IconClipboard size={20} />, label: 'Tasks' },
    { id: 'storyboard', icon: <IconLayout size={20} />, label: 'Storyboard' },
  ]
  if (staff) mainNav.push({ id: 'activity', icon: <IconBarChart size={20} />, label: 'Activity' })
  if (staff) mainNav.push({ id: 'review', icon: <IconEye size={20} />, label: 'Review', badge: reviewCount || 0 })

  const closePopups = () => { setShowCalendar(false); setShowNotifs(false) }

  const handleNotifClick = (n) => {
    onMarkRead(n.id)
    if (n.link_type && n.link_id) {
      onNavigate(n.link_type === 'task' ? 'tasks' : n.link_type === 'shot' ? 'shots' : 'overview', n.link_id)
    }
    setShowNotifs(false)
    setShowMore(false)
  }

  // ═══════════════════════════════════════════
  // ██  MOBILE: Bottom Tab Bar
  // ═══════════════════════════════════════════
  if (isMobile) {
    const mobileNav = [
      { id: 'overview', icon: <IconHome size={22} />, label: 'Home' },
      { id: 'tasks', icon: <IconClipboard size={22} />, label: 'Tasks' },
      { id: 'shots', icon: <IconFilm size={22} />, label: 'Shots' },
      { id: 'notifications', icon: <IconBell size={22} />, label: 'Alerts', badge: unreadCount },
    ]

    return (
      <>
        {/* Bottom Tab Bar */}
        <div className="mobile-bottom-bar" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, height: 64,
          background: '#fff', borderTop: '1px solid #E8ECF1',
          display: 'flex', alignItems: 'center', justifyContent: 'space-around',
          zIndex: 40, paddingBottom: 4,
          boxShadow: '0 -2px 12px rgba(0,0,0,0.04)',
        }}>
          {mobileNav.map(n => {
            const active = view === n.id
            return (
              <button key={n.id} onClick={() => { setView(n.id); setShowMore(false) }} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px 0', minWidth: 56, position: 'relative',
                color: active ? '#6C5CE7' : '#94A3B8',
                transition: 'color 0.15s ease',
              }}>
                {n.icon}
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{n.label}</span>
                {n.badge > 0 && (
                  <span style={{
                    position: 'absolute', top: 2, right: 6,
                    fontSize: 9, fontWeight: 700, background: '#EF4444', color: '#fff',
                    padding: '1px 5px', borderRadius: 8, minWidth: 16, textAlign: 'center',
                  }}>{n.badge}</span>
                )}
              </button>
            )
          })}

          {/* More button */}
          <button onClick={() => setShowMore(!showMore)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 2, background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 0', minWidth: 56,
            color: showMore ? '#6C5CE7' : '#94A3B8',
            transition: 'color 0.15s ease',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
            </svg>
            <span style={{ fontSize: 10, fontWeight: showMore ? 700 : 500 }}>More</span>
          </button>
        </div>

        {/* "More" Menu — slide-up overlay */}
        {showMore && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 90 }}
              onClick={() => setShowMore(false)} />
            <div style={{
              position: 'fixed', bottom: 64, left: 0, right: 0, zIndex: 91,
              background: '#fff', borderRadius: '20px 20px 0 0',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
              animation: 'slideInUp 0.2s ease',
              maxHeight: '70vh', overflowY: 'auto',
              padding: '12px 0 20px',
            }}>
              {/* User header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px 16px', borderBottom: '1px solid #F1F5F9' }}>
                <Av name={user.full_name} size={36} url={user.avatar_url} mood={user.mood_emoji} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{user.full_name}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{displayRole(user.role)}</div>
                </div>
              </div>

              {/* Menu items */}
              {[
                { id: 'storyboard', icon: <IconLayout size={20} />, label: 'Storyboard', show: true },
                ...(staff ? [
                  { id: 'activity', icon: <IconBarChart size={20} />, label: 'Activity', show: true },
                  { id: 'review', icon: <IconEye size={20} />, label: 'Review', badge: reviewCount, show: true },
                ] : []),
                { id: 'calendar', icon: <IconCalendar size={20} />, label: 'Calendar', show: true, action: () => { setShowCalendar(true); setShowMore(false) } },
                ...(showTcg ? [{ id: 'pack', icon: <span style={{ fontSize: 20 }}>🎴</span>, label: 'Pack', show: true }] : []),
                { id: 'crew', icon: <IconUsers size={20} />, label: 'Crew', show: true },
                { id: 'profile', icon: <Av name={user.full_name} size={20} url={user.avatar_url} />, label: 'Profile', show: true },
              ].filter(i => i.show).map(item => (
                <button key={item.id} onClick={() => {
                  if (item.action) { item.action(); return }
                  setView(item.id); setShowMore(false)
                }} style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '14px 20px', background: view === item.id ? 'rgba(108,92,231,0.06)' : 'none',
                  border: 'none', cursor: 'pointer', color: view === item.id ? '#6C5CE7' : '#1a1a2e',
                  fontSize: 14, fontWeight: view === item.id ? 600 : 400, position: 'relative',
                  transition: 'background 0.1s ease',
                }}>
                  <span style={{ width: 24, display: 'flex', justifyContent: 'center', color: view === item.id ? '#6C5CE7' : '#64748B' }}>{item.icon}</span>
                  {item.label}
                  {item.badge > 0 && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, background: '#6C5CE7', color: '#fff',
                      padding: '2px 7px', borderRadius: 8, marginLeft: 'auto',
                    }}>{item.badge}</span>
                  )}
                </button>
              ))}

              {/* Sign out */}
              <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 8, padding: '12px 20px 0' }}>
                <button onClick={onSignOut} style={{
                  display: 'flex', alignItems: 'center', gap: 14, width: '100%',
                  padding: '14px 0', background: 'none', border: 'none',
                  cursor: 'pointer', color: '#EF4444', fontSize: 14, fontWeight: 500,
                }}>
                  <IconLogOut size={20} /> Sign Out
                </button>
              </div>
            </div>
          </>
        )}

        {/* Calendar overlay (mobile) */}
        {showCalendar && (
          <>
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', zIndex: 95 }}
              onClick={() => setShowCalendar(false)} />
            <div style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 96,
              background: '#fff', borderRadius: '20px 20px 0 0',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
              animation: 'slideInUp 0.2s ease',
              maxHeight: '80vh', overflowY: 'auto', padding: 20,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Calendar</span>
                <button onClick={() => setShowCalendar(false)} style={{
                  background: '#F1F5F9', border: 'none', borderRadius: 8, width: 32, height: 32,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#64748B', fontSize: 18,
                }}>✕</button>
              </div>
              <CalendarPopup events={events} user={user} onCreate={onCreateEvent} onDelete={onDeleteEvent} requestConfirm={requestConfirm} />
            </div>
          </>
        )}
      </>
    )
  }

  // ═══════════════════════════════════════════
  // ██  DESKTOP: Original Sidebar (unchanged)
  // ═══════════════════════════════════════════
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
        <div style={{ height: 68, display: 'flex', alignItems: 'center', borderBottom: '1px solid #F1F5F9', overflow: 'hidden' }}>
          <div style={{ width: RAIL_W, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img
              src={houstonLogo}
              alt="BigRock"
              style={{ height: 38, width: 'auto', objectFit: 'contain', maxWidth: RAIL_W - 16 }}
            />
          </div>
          <span style={{
            fontSize: 13, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap',
            background: '#000000', borderRadius: 8, padding: '4px 14px',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            letterSpacing: 0.8, textAlign: 'center',
          }}>Hub</span>
        </div>

        {/* Notifications */}
        <div style={{ paddingTop: 8, position: 'relative' }}>
          <NavBtn
            icon={<IconBell size={20} />}
            label="Notifications"
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
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: '#6C5CE7', color: '#fff', padding: '2px 7px', borderRadius: 8, minWidth: 18, textAlign: 'center' }}>{unreadCount}</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={onMarkAllRead}
                      style={{ fontSize: 11, color: '#6C5CE7', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: '2px 4px' }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                    >Mark all read</button>
                  )}
                </div>
                {/* List */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
                  {(!notifications || notifications.length === 0) ? (
                    <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>No notifications</div>
                  ) : notifications.slice(0, 30).map(n => {
                    const cat = getNotifCat(n.type)
                    const unread = !n.read
                    const date = new Date(n.created_at)
                    const diffMin = Math.floor((Date.now() - date) / 60000)
                    const diffH = Math.floor(diffMin / 60)
                    const diffD = Math.floor(diffH / 24)
                    const timeStr = diffMin < 1 ? 'Now' : diffMin < 60 ? `${diffMin}m` : diffH < 24 ? `${diffH}h` : diffD < 7 ? `${diffD}d` : date.toLocaleDateString('en', { day: 'numeric', month: 'short' })
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', cursor: 'pointer', borderRadius: 12,
                          marginBottom: 2,
                          borderLeft: unread ? `3.5px solid ${cat.color}` : '3.5px solid transparent',
                          background: unread ? cat.bg : 'transparent',
                          transition: 'all 0.12s ease',
                          opacity: unread ? 1 : 0.65,
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = unread ? cat.bg : '#F8FAFC'
                          e.currentTarget.style.transform = 'translateX(2px)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = unread ? cat.bg : 'transparent'
                          e.currentTarget.style.transform = 'translateX(0)'
                        }}
                      >
                        {/* Icon */}
                        <span style={{
                          fontSize: 15, width: 30, height: 30, borderRadius: 8,
                          background: unread ? `${cat.color}15` : '#F1F5F9',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>{cat.icon}</span>
                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                            <span style={{
                              fontSize: 8, fontWeight: 700, color: cat.color, textTransform: 'uppercase',
                              letterSpacing: '0.04em', background: unread ? `${cat.color}15` : '#E8ECF1',
                              padding: '1px 5px', borderRadius: 3,
                            }}>{cat.label}</span>
                            {unread && <span style={{ width: 5, height: 5, borderRadius: '50%', background: cat.color }} />}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: unread ? 600 : 400, color: '#1a1a2e', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                          {n.body && <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.body}</div>}
                        </div>
                        {/* Time */}
                        <span style={{ fontSize: 9, color: '#B0B8C4', whiteSpace: 'nowrap', flexShrink: 0 }}>{timeStr}</span>
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
            <NavBtn key={n.id} icon={n.icon} label={n.label} active={view === n.id} onClick={() => setView(n.id)} badge={n.badge} />
          ))}
        </div>

        {/* Pack Section — visible to admins always, others when game active */}
        {showTcg && (
          <div style={{ borderTop: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9', padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', borderRadius: 12,
                width: hovered ? Math.round(EXPANDED_W * 0.6) : RAIL_W - 20,
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                overflow: 'hidden',
                transform: packPressed ? 'scale(0.93)' : packHover ? 'scale(1.12)' : 'scale(1)',
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
        )}

        {/* Bottom: Calendar, Crew, User */}
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '8px 0' }}>
          <div style={{ position: 'relative' }}>
            <NavBtn icon={<IconCalendar size={20} />} label="Calendar" active={showCalendar} onClick={() => { setShowCalendar(!showCalendar); setShowNotifs(false) }} />
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
                <div style={{ fontSize: 10, color: '#94A3B8' }}>{displayRole(user.role)}</div>
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
