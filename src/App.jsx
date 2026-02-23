import { useState, useEffect, useCallback, useRef } from 'react'
import {
  supabase, signInWithGoogle, signOut,
  getProfile, getAllProfiles, updateProfileRole,
  getShots, createShot, updateShot, deleteShot,
  getTasks, createTask, updateTask, deleteTask,
  getComments, addComment,
  getCalendarEvents, createCalendarEvent, deleteCalendarEvent,
  getNotifications, markNotificationRead, markAllNotificationsRead, sendNotification,
  uploadConceptImage, subscribeToTable
} from './lib/supabase.js'

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const DEPTS = [
  { id: 'concept', label: 'Concept', icon: '🎨' },
  { id: 'modeling', label: 'Modeling', icon: '🧊' },
  { id: 'texturing', label: 'Texturing', icon: '🖌' },
  { id: 'rigging', label: 'Rigging', icon: '🦴' },
  { id: 'animation', label: 'Animation', icon: '🎬' },
  { id: 'compositing', label: 'Comp', icon: '✨' },
]

const SHOT_STATUSES = [
  { id: 'not_started', label: 'To Do', color: '#555', bg: '#1e1e28' },
  { id: 'in_progress', label: 'WIP', color: '#6ea8fe', bg: '#182638' },
  { id: 'review', label: 'Review', color: '#f0c36d', bg: '#2a2518' },
  { id: 'needs_revision', label: 'Fix', color: '#f07070', bg: '#281818' },
  { id: 'approved', label: 'Done', color: '#6ee7a0', bg: '#18281e' },
]

const TASK_STATUSES = [
  { id: 'todo', label: 'To Do', color: '#555', bg: '#1e1e28' },
  { id: 'wip', label: 'WIP', color: '#6ea8fe', bg: '#182638' },
  { id: 'review', label: 'Review', color: '#f0c36d', bg: '#2a2518' },
  { id: 'approved', label: 'Done', color: '#6ee7a0', bg: '#18281e' },
]

const getShotStatus = (id) => SHOT_STATUSES.find(s => s.id === id) || SHOT_STATUSES[0]
const getTaskStatus = (id) => TASK_STATUSES.find(s => s.id === id) || TASK_STATUSES[0]
const isStaff = (role) => role && role !== 'studente'

// ═══════════════════════════════════════════
// SHARED UI COMPONENTS
// ═══════════════════════════════════════════

function Fade({ children, delay = 0 }) {
  const [show, setShow] = useState(false)
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t) }, [delay])
  return <div style={{ opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(6px)', transition: 'all 0.35s ease' }}>{children}</div>
}

function Card({ children, style, onClick }) {
  const [h, setH] = useState(false)
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={onClick}
      style={{
        background: h ? '#1a1a24' : '#15151e', border: `1px solid ${h ? '#2c2c3a' : '#1e1e2a'}`,
        borderRadius: 14, transition: 'all 0.2s ease', padding: 20,
        transform: h && onClick ? 'translateY(-1px)' : 'none',
        boxShadow: h ? '0 6px 24px rgba(0,0,0,0.2)' : 'none',
        cursor: onClick ? 'pointer' : 'default', ...style,
      }}>{children}</div>
  )
}

function Av({ name, size = 30, url }) {
  if (url) return <img src={url} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
  const ini = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const hue = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue},30%,18%)`, border: `1.5px solid hsl(${hue},55%,65%,0.3)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 600, color: `hsl(${hue},55%,65%)`, flexShrink: 0,
    }}>{ini}</div>
  )
}

function Bar({ value, h = 4 }) {
  return (
    <div style={{ width: '100%', height: h, borderRadius: h, background: '#1e1e2a', overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(100, value)}%`, height: '100%', borderRadius: h,
        background: value > 70 ? '#6ee7a0' : value > 35 ? '#6ea8fe' : '#f0c36d',
        transition: 'width 0.8s cubic-bezier(0.16,1,0.3,1)',
      }} />
    </div>
  )
}

function Btn({ children, onClick, variant = 'default', style = {}, disabled }) {
  const [h, setH] = useState(false)
  const styles = {
    default: { bg: '#1e1e2e', hbg: '#252535', color: '#ccc', border: '#2a2a3a' },
    primary: { bg: '#6ea8fe18', hbg: '#6ea8fe28', color: '#6ea8fe', border: '#6ea8fe30' },
    danger: { bg: '#f0707018', hbg: '#f0707028', color: '#f07070', border: '#f0707030' },
    success: { bg: '#6ee7a018', hbg: '#6ee7a028', color: '#6ee7a0', border: '#6ee7a030' },
  }[variant]
  return (
    <button disabled={disabled} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={onClick}
      style={{
        background: h ? styles.hbg : styles.bg, color: styles.color,
        border: `1px solid ${styles.border}`, borderRadius: 10,
        padding: '8px 16px', fontSize: 12, fontWeight: 600,
        transition: 'all 0.15s ease', opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer', ...style,
      }}>{children}</button>
  )
}

function Input({ value, onChange, placeholder, style = {}, multiline, ...props }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <Tag value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{
        width: '100%', background: '#1a1a26', border: '1px solid #2a2a36', borderRadius: 10,
        padding: '10px 14px', color: '#e0e0e8', fontSize: 13, outline: 'none',
        transition: 'border-color 0.2s ease', resize: multiline ? 'vertical' : undefined,
        minHeight: multiline ? 80 : undefined, ...style,
      }}
      onFocus={e => e.target.style.borderColor = '#6ea8fe55'}
      onBlur={e => e.target.style.borderColor = '#2a2a36'}
      {...props}
    />
  )
}

function Select({ value, onChange, options, placeholder, style = {} }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        background: '#1a1a26', border: '1px solid #2a2a36', borderRadius: 10,
        padding: '10px 14px', color: '#e0e0e8', fontSize: 13, outline: 'none',
        transition: 'border-color 0.2s ease', cursor: 'pointer', ...style,
      }}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#15151e', border: '1px solid #2a2a3a', borderRadius: 16,
        padding: 24, width: '90%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto',
        animation: 'fadeIn 0.2s ease',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#777', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function NavBtn({ icon, label, active, onClick, badge }) {
  const [h, setH] = useState(false)
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', margin: '2px 10px', borderRadius: 10,
        cursor: 'pointer', userSelect: 'none', position: 'relative',
        background: active ? '#1e1e2e' : h ? '#18181f' : 'transparent', transition: 'all 0.15s ease',
      }}>
      {active && <div style={{ position: 'absolute', left: 0, width: 3, height: 18, borderRadius: 2, background: '#6ea8fe' }} />}
      <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#e8e8f0' : h ? '#b0b0c0' : '#777' }}>{label}</span>
      {badge > 0 && <span style={{ fontSize: 10, fontWeight: 600, background: '#f0707033', color: '#f07070', padding: '2px 7px', borderRadius: 10 }}>{badge}</span>}
    </div>
  )
}

function StatusBadge({ status, type = 'shot' }) {
  const s = type === 'shot' ? getShotStatus(status) : getTaskStatus(status)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
      {s.label}
    </span>
  )
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '50px 20px', color: '#555' }}>
      <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#777', marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12 }}>{sub}</div>
    </div>
  )
}

// ═══════════════════════════════════════════
// LOGIN PAGE
// ═══════════════════════════════════════════

function LoginPage() {
  const [loading, setLoading] = useState(false)
  const handleLogin = async () => {
    setLoading(true)
    await signInWithGoogle()
    setLoading(false)
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0e14' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, borderRadius: 16, margin: '0 auto 20px',
          background: 'linear-gradient(135deg, #6ea8fe, #b07ce8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 700, color: '#fff',
        }}>BR</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 6 }}>BigRock Studios</h1>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 30 }}>Production Pipeline</p>
        <Btn variant="primary" onClick={handleLogin} style={{ padding: '12px 32px', fontSize: 14 }}>
          {loading ? 'Connecting...' : '🔑 Sign in with Google'}
        </Btn>
        <p style={{ fontSize: 11, color: '#444', marginTop: 14 }}>Use your @bigrock.it email</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// OVERVIEW PAGE
// ═══════════════════════════════════════════

function OverviewPage({ shots, tasks, profiles, user, onNav }) {
  const total = shots.length * DEPTS.length
  const done = shots.reduce((s, sh) => s + DEPTS.filter(d => sh[`status_${d.id}`] === 'approved').length, 0)
  const wip = shots.reduce((s, sh) => s + DEPTS.filter(d => sh[`status_${d.id}`] === 'in_progress').length, 0)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const myTasks = tasks.filter(t => t.assigned_to === user.id)
  const reviewTasks = tasks.filter(t => t.status === 'review')

  return (
    <div>
      <Fade><h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>👋 Ciao {user.full_name.split(' ')[0]}</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>Production Pipeline Overview</p></Fade>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          { l: 'Shots', v: shots.length, e: '🎬' },
          { l: 'Completed', v: done, e: '✅' },
          { l: 'In Progress', v: wip, e: '🔧' },
          { l: isStaff(user.role) ? 'To Review' : 'My Tasks', v: isStaff(user.role) ? reviewTasks.length : myTasks.length, e: '📋' },
        ].map((s, i) => (
          <Fade key={s.l} delay={i * 50}><Card>
            <div style={{ fontSize: 11, color: '#666', marginBottom: 8 }}>{s.e} {s.l}</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{s.v}</div>
          </Card></Fade>
        ))}
      </div>

      <Fade delay={200}><Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>📊 Pipeline Progress</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#6ea8fe' }}>{pct}%</span>
        </div>
        <Bar value={pct} h={6} />
        <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
          {SHOT_STATUSES.map(st => {
            const c = shots.reduce((s, sh) => s + DEPTS.filter(d => sh[`status_${d.id}`] === st.id).length, 0)
            return <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: st.color }} />
              <span style={{ fontSize: 11, color: '#777' }}>{st.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: st.color }}>{c}</span>
            </div>
          })}
        </div>
      </Card></Fade>

      <Fade delay={300}><Card>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>🏗 Departments</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DEPTS.map(dept => {
            const t = shots.length
            const d = shots.filter(sh => sh[`status_${dept.id}`] === 'approved').length
            return <div key={dept.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12 }}>{dept.icon} {dept.label}</span>
                <span style={{ fontSize: 11, color: '#777', fontWeight: 600 }}>{d}/{t}</span>
              </div>
              <Bar value={t > 0 ? Math.round((d / t) * 100) : 0} h={3} />
            </div>
          })}
        </div>
      </Card></Fade>
    </div>
  )
}

// ═══════════════════════════════════════════
// SHOT TRACKER PAGE
// ═══════════════════════════════════════════

function ShotTrackerPage({ shots, user, onUpdateShot, onCreateShot, onDeleteShot }) {
  const [showCreate, setShowCreate] = useState(false)
  const [newShot, setNewShot] = useState({ code: '', sequence: 'SEQ01', description: '' })
  const staff = isStaff(user.role)

  const cycleShotStatus = async (shot, deptId) => {
    if (!staff) return
    const key = `status_${deptId}`
    const order = ['not_started', 'in_progress', 'review', 'needs_revision', 'approved']
    const curr = order.indexOf(shot[key])
    const next = order[(curr + 1) % order.length]
    await onUpdateShot(shot.id, { [key]: next })
  }

  const handleCreate = async () => {
    if (!newShot.code) return
    await onCreateShot(newShot)
    setNewShot({ code: '', sequence: 'SEQ01', description: '' })
    setShowCreate(false)
  }

  const seqs = [...new Set(shots.map(sh => sh.sequence))].sort()

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>🎬 Shot Tracker</h1>
            <p style={{ fontSize: 13, color: '#666' }}>{staff ? 'Click cells to cycle status' : 'Read-only view'}</p>
          </div>
          {staff && <Btn variant="primary" onClick={() => setShowCreate(true)}>+ Add Shot</Btn>}
        </div>
      </Fade>

      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '180px repeat(6, 1fr)', gap: 3,
        padding: '8px 0 10px', borderBottom: '1px solid #1e1e2a', marginBottom: 6,
        position: 'sticky', top: 56, background: '#0e0e14', zIndex: 5,
      }}>
        <div style={{ fontSize: 10, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 8 }}>Shot</div>
        {DEPTS.map(d => (
          <div key={d.id} style={{ fontSize: 10, textAlign: 'center', color: '#666' }}>
            <span style={{ fontSize: 13 }}>{d.icon}</span>
            <div style={{ fontSize: 9, marginTop: 1, fontWeight: 500 }}>{d.label}</div>
          </div>
        ))}
      </div>

      {shots.length === 0 ? (
        <EmptyState icon="🎬" title="No shots yet" sub={staff ? 'Add the first shot to get started' : 'Shots will appear here'} />
      ) : (
        seqs.map((seq, si) => (
          <Fade key={seq} delay={si * 60}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#444', padding: '8px 8px 4px', letterSpacing: '0.04em' }}>{seq}</div>
              {shots.filter(sh => sh.sequence === seq).map(shot => (
                <ShotRow key={shot.id} shot={shot} staff={staff} onCycle={cycleShotStatus} onDelete={onDeleteShot} />
              ))}
            </div>
          </Fade>
        ))
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 20, padding: '12px 0', borderTop: '1px solid #1e1e2a' }}>
        {SHOT_STATUSES.map(st => (
          <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: 3, background: st.bg, border: `1px solid ${st.color}30` }} />
            <span style={{ fontSize: 10, color: '#666' }}>{st.label}</span>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Shot">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input value={newShot.code} onChange={v => setNewShot(p => ({ ...p, code: v }))} placeholder="Shot code (e.g. SH010)" />
          <Input value={newShot.sequence} onChange={v => setNewShot(p => ({ ...p, sequence: v }))} placeholder="Sequence (e.g. SEQ01)" />
          <Input value={newShot.description} onChange={v => setNewShot(p => ({ ...p, description: v }))} placeholder="Description" />
          <Btn variant="primary" onClick={handleCreate}>Create Shot</Btn>
        </div>
      </Modal>
    </div>
  )
}

function ShotRow({ shot, staff, onCycle, onDelete }) {
  const [h, setH] = useState(false)
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      display: 'grid', gridTemplateColumns: '180px repeat(6, 1fr)', gap: 3, padding: '6px 0', borderRadius: 8,
      background: h ? '#13131c' : 'transparent', transition: 'background 0.12s ease',
    }}>
      <div style={{ paddingLeft: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{shot.code}</span>
          <div style={{ fontSize: 10, color: '#555', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shot.description}</div>
        </div>
        {staff && h && (
          <button onClick={() => onDelete(shot.id)}
            style={{ background: 'none', border: 'none', color: '#f07070', fontSize: 12, cursor: 'pointer', opacity: 0.5, padding: 4 }}>🗑</button>
        )}
      </div>
      {DEPTS.map(dept => (
        <ShotCell key={dept.id} status={shot[`status_${dept.id}`]} onClick={() => onCycle(shot, dept.id)} clickable={staff} />
      ))}
    </div>
  )
}

function ShotCell({ status, onClick, clickable }) {
  const [h, setH] = useState(false)
  const st = getShotStatus(status)
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={clickable ? onClick : undefined}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px 2px' }}>
      <div style={{
        width: '100%', height: 30, borderRadius: 8,
        background: h && clickable ? `${st.color}20` : st.bg,
        border: `1px solid ${h && clickable ? `${st.color}40` : `${st.color}15`}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s ease', cursor: clickable ? 'pointer' : 'default',
        transform: h && clickable ? 'scale(1.06)' : 'none', position: 'relative',
      }}>
        {status === 'approved' && <span style={{ fontSize: 13, color: st.color }}>✓</span>}
        {status === 'in_progress' && <div style={{ width: 6, height: 6, borderRadius: '50%', background: st.color, boxShadow: `0 0 6px ${st.color}55` }} />}
        {status === 'review' && <span style={{ fontSize: 11, color: st.color }}>?</span>}
        {status === 'needs_revision' && <span style={{ fontSize: 11, color: st.color }}>↺</span>}
        {h && clickable && <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a28', border: '1px solid #2a2a3a', borderRadius: 6, padding: '3px 8px',
          fontSize: 9, fontWeight: 600, color: st.color, whiteSpace: 'nowrap', zIndex: 20,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)', pointerEvents: 'none',
        }}>{st.label}</div>}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// TASKS PAGE
// ═══════════════════════════════════════════

function TasksPage({ tasks, shots, profiles, user, onCreateTask, onUpdateTask, onDeleteTask, onAddComment }) {
  const [filter, setFilter] = useState({ dept: '', status: '', user: '' })
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [viewMode, setViewMode] = useState('mine') // 'mine' | 'all'
  const staff = isStaff(user.role)

  const filteredTasks = tasks.filter(t => {
    if (viewMode === 'mine' && !staff && t.assigned_to !== user.id) return false
    if (filter.dept && t.department !== filter.dept) return false
    if (filter.status && t.status !== filter.status) return false
    if (filter.user && t.assigned_to !== filter.user) return false
    return true
  })

  const students = profiles.filter(p => p.role === 'studente')

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>📋 Tasks</h1>
            <p style={{ fontSize: 13, color: '#666' }}>{staff ? 'Manage all tasks' : 'Your assignments'}</p>
          </div>
          {staff && <Btn variant="primary" onClick={() => setShowCreate(true)}>+ New Task</Btn>}
        </div>
      </Fade>

      {/* View toggle + Filters */}
      <Fade delay={50}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          {!staff ? null : (
            <>
              <Pill label="My View" active={viewMode === 'mine'} onClick={() => setViewMode('mine')} />
              <Pill label="All Tasks" active={viewMode === 'all'} onClick={() => setViewMode('all')} />
              <div style={{ width: 1, height: 20, background: '#2a2a3a', margin: '0 4px' }} />
            </>
          )}
          <Pill label="All Depts" active={!filter.dept} onClick={() => setFilter(f => ({ ...f, dept: '' }))} />
          {DEPTS.map(d => <Pill key={d.id} label={`${d.icon} ${d.label}`} active={filter.dept === d.id} onClick={() => setFilter(f => ({ ...f, dept: d.id }))} />)}
          {staff && (
            <>
              <div style={{ width: 1, height: 20, background: '#2a2a3a', margin: '0 4px' }} />
              <Select value={filter.user} onChange={v => setFilter(f => ({ ...f, user: v }))}
                options={students.map(s => ({ value: s.id, label: s.full_name }))} placeholder="All students"
                style={{ padding: '5px 10px', fontSize: 11, borderRadius: 8 }} />
            </>
          )}
        </div>
      </Fade>

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <EmptyState icon="📋" title="No tasks" sub={staff ? 'Create the first task' : 'No tasks assigned to you yet'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredTasks.map((task, i) => (
            <Fade key={task.id} delay={i * 30}>
              <TaskCard task={task} user={user} staff={staff} onClick={() => setSelectedTask(task)} />
            </Fade>
          ))}
        </div>
      )}

      {/* Create Task Modal */}
      <CreateTaskModal open={showCreate} onClose={() => setShowCreate(false)}
        shots={shots} students={students} user={user} onCreate={onCreateTask} />

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal task={selectedTask} user={user} staff={staff}
          onClose={() => setSelectedTask(null)} onUpdate={onUpdateTask}
          onDelete={onDeleteTask} onComment={onAddComment} />
      )}
    </div>
  )
}

function Pill({ label, active, onClick }) {
  const [h, setH] = useState(false)
  return (
    <span onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={onClick}
      style={{
        padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: active ? 600 : 400,
        cursor: 'pointer', userSelect: 'none',
        background: active ? '#6ea8fe18' : h ? '#1a1a24' : 'transparent',
        color: active ? '#6ea8fe' : h ? '#ccc' : '#777',
        border: `1px solid ${active ? '#6ea8fe30' : 'transparent'}`,
        transition: 'all 0.15s ease', whiteSpace: 'nowrap',
      }}>{label}</span>
  )
}

function TaskCard({ task, user, staff, onClick }) {
  const [h, setH] = useState(false)
  const dept = DEPTS.find(d => d.id === task.department)
  const isOwner = task.assigned_to === user.id
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={onClick}
      style={{
        padding: '14px 18px', borderRadius: 12, cursor: 'pointer',
        background: h ? '#1a1a24' : '#15151e', border: `1px solid ${h ? '#2c2c3a' : '#1e1e2a'}`,
        borderLeft: isOwner ? '3px solid #6ea8fe' : '3px solid transparent',
        transition: 'all 0.15s ease', transform: h ? 'translateY(-1px)' : 'none',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14 }}>{dept?.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{task.title}</span>
          </div>
          <div style={{ fontSize: 11, color: '#666', display: 'flex', gap: 10, alignItems: 'center' }}>
            {task.shot && <span>{task.shot.code}</span>}
            {task.assigned_user && <span>→ {task.assigned_user.full_name}</span>}
          </div>
        </div>
        <StatusBadge status={task.status} type="task" />
      </div>
    </div>
  )
}

function CreateTaskModal({ open, onClose, shots, students, user, onCreate }) {
  const [form, setForm] = useState({ title: '', description: '', department: '', assigned_to: '', shot_id: '' })
  const handleCreate = async () => {
    if (!form.title || !form.department || !form.assigned_to) return
    await onCreate({ ...form, created_by: user.id })
    setForm({ title: '', description: '', department: '', assigned_to: '', shot_id: '' })
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title="New Task">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Input value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Task title" />
        <Input value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Description (optional)" multiline />
        <Select value={form.department} onChange={v => setForm(f => ({ ...f, department: v }))}
          options={DEPTS.map(d => ({ value: d.id, label: `${d.icon} ${d.label}` }))} placeholder="Select department" />
        <Select value={form.assigned_to} onChange={v => setForm(f => ({ ...f, assigned_to: v }))}
          options={students.map(s => ({ value: s.id, label: s.full_name }))} placeholder="Assign to student" />
        <Select value={form.shot_id} onChange={v => setForm(f => ({ ...f, shot_id: v || null }))}
          options={shots.map(s => ({ value: s.id, label: `${s.code} — ${s.description || s.sequence}` }))} placeholder="Link to shot (optional)" />
        <Btn variant="primary" onClick={handleCreate} disabled={!form.title || !form.department || !form.assigned_to}>Create Task</Btn>
      </div>
    </Modal>
  )
}

function TaskDetailModal({ task, user, staff, onClose, onUpdate, onDelete, onComment }) {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const dept = DEPTS.find(d => d.id === task.department)
  const isOwner = task.assigned_to === user.id
  const canComment = staff || isOwner

  useEffect(() => {
    getComments(task.id).then(c => { setComments(c); setLoading(false) })
  }, [task.id])

  const handleComment = async () => {
    if (!newComment.trim()) return
    const { data } = await onComment(task.id, user.id, newComment.trim())
    if (data) setComments(prev => [...prev, data])
    setNewComment('')
  }

  const handleSubmit = () => onUpdate(task.id, { status: 'review' })
  const handleApprove = () => onUpdate(task.id, { status: 'approved' })
  const handleReject = () => onUpdate(task.id, { status: 'wip' })
  const handleDelete = () => { onDelete(task.id); onClose() }

  return (
    <Modal open={true} onClose={onClose} title={`${dept?.icon} ${task.title}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Info */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusBadge status={task.status} type="task" />
          {task.shot && <span style={{ fontSize: 11, color: '#888', background: '#1e1e2a', padding: '3px 8px', borderRadius: 6 }}>{task.shot.code}</span>}
          {task.assigned_user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Av name={task.assigned_user.full_name} size={20} />
              <span style={{ fontSize: 11, color: '#888' }}>{task.assigned_user.full_name}</span>
            </div>
          )}
        </div>

        {task.description && <p style={{ fontSize: 12, color: '#aaa', lineHeight: 1.6, padding: '8px 12px', background: '#1a1a24', borderRadius: 10 }}>{task.description}</p>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isOwner && task.status === 'wip' && <Btn variant="primary" onClick={handleSubmit}>📤 Submit for Review</Btn>}
          {isOwner && task.status === 'todo' && <Btn variant="primary" onClick={() => onUpdate(task.id, { status: 'wip' })}>▶ Start Working</Btn>}
          {staff && task.status === 'review' && <Btn variant="success" onClick={handleApprove}>✓ Approve</Btn>}
          {staff && task.status === 'review' && <Btn variant="danger" onClick={handleReject}>↺ Request Changes</Btn>}
          {staff && <Btn variant="danger" onClick={handleDelete}>🗑 Delete</Btn>}
        </div>

        {/* Comments */}
        <div style={{ borderTop: '1px solid #1e1e2a', paddingTop: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>💬 Comments</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto', marginBottom: 12 }}>
            {loading ? <span style={{ color: '#555', fontSize: 12 }}>Loading...</span> :
              comments.length === 0 ? <span style={{ color: '#555', fontSize: 12 }}>No comments yet</span> :
              comments.map(c => (
                <div key={c.id} style={{ padding: '10px 12px', borderRadius: 10, background: '#1a1a24' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Av name={c.author?.full_name} size={18} />
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{c.author?.full_name}</span>
                    {c.author?.role !== 'studente' && <span style={{ fontSize: 9, color: '#6ea8fe', background: '#6ea8fe18', padding: '1px 5px', borderRadius: 4 }}>{c.author?.role}</span>}
                    <span style={{ fontSize: 10, color: '#444', marginLeft: 'auto' }}>{new Date(c.created_at).toLocaleDateString('it')}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#ccc', lineHeight: 1.5 }}>{c.body}</div>
                </div>
              ))
            }
          </div>
          {canComment && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Input value={newComment} onChange={setNewComment} placeholder="Write a comment..."
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleComment()} style={{ flex: 1 }} />
              <Btn variant="primary" onClick={handleComment}>Send</Btn>
            </div>
          )}
          {!canComment && <p style={{ fontSize: 11, color: '#555' }}>Only the assigned student and staff can comment.</p>}
        </div>
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════
// STORYBOARD / MIRO PAGE
// ═══════════════════════════════════════════

function StoryboardPage() {
  const boardId = import.meta.env.VITE_MIRO_BOARD_ID
  return (
    <div>
      <Fade>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>🗂 Storyboard</h1>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>Miro Board — Storyboard & WIP</p>
      </Fade>
      <Fade delay={100}>
        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #1e1e2a', height: 'calc(100vh - 160px)' }}>
          {boardId ? (
            <iframe
              src={`https://miro.com/app/live-embed/${boardId}/`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="fullscreen"
              allowFullScreen
            />
          ) : (
            <EmptyState icon="🗂" title="Miro not configured" sub="Add VITE_MIRO_BOARD_ID to your .env file" />
          )}
        </div>
      </Fade>
    </div>
  )
}

// ═══════════════════════════════════════════
// CALENDAR / MILESTONES PAGE
// ═══════════════════════════════════════════

function CalendarPage({ events, user, onCreate, onDelete }) {
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', event_date: '', event_time: '', is_milestone: false, description: '' })
  const staff = isStaff(user.role)

  const handleCreate = async () => {
    if (!form.title || !form.event_date) return
    await onCreate({ ...form, created_by: user.id, event_time: form.event_time || null })
    setForm({ title: '', event_date: '', event_time: '', is_milestone: false, description: '' })
    setShowCreate(false)
  }

  const milestones = events.filter(e => e.is_milestone)
  const upcoming = events.filter(e => !e.is_milestone && new Date(e.event_date) >= new Date(new Date().toDateString()))

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>📅 Calendar</h1>
            <p style={{ fontSize: 13, color: '#666' }}>Milestones & events</p>
          </div>
          {staff && <Btn variant="primary" onClick={() => setShowCreate(true)}>+ Add Event</Btn>}
        </div>
      </Fade>

      {/* Milestones */}
      <Fade delay={50}><Card style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>🏁 Milestones</h3>
        {milestones.length === 0 ? <span style={{ color: '#555', fontSize: 12 }}>No milestones yet</span> : (
          <div style={{ position: 'relative', paddingLeft: 24 }}>
            <div style={{ position: 'absolute', left: 8, top: 6, bottom: 6, width: 1.5, background: '#2a2a3a', borderRadius: 1 }} />
            {milestones.map((ms, i) => {
              const past = new Date(ms.event_date) < new Date()
              return (
                <div key={ms.id} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: i < milestones.length - 1 ? 22 : 0, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: -20, width: 14, height: 14, borderRadius: '50%', zIndex: 1,
                    background: past ? '#6ee7a0' : '#1e1e2a', border: past ? '2px solid #6ee7a044' : '2px solid #3a3a4a',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff',
                  }}>{past ? '✓' : ''}</div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: past ? '#6ee7a0' : '#ccc' }}>{ms.title}</span>
                  <span style={{ fontSize: 11, color: '#555' }}>{new Date(ms.event_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  {staff && <button onClick={() => onDelete(ms.id)} style={{ background: 'none', border: 'none', color: '#f07070', fontSize: 11, cursor: 'pointer', opacity: 0.4 }}>✕</button>}
                </div>
              )
            })}
          </div>
        )}
      </Card></Fade>

      {/* Upcoming Events */}
      <Fade delay={150}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>📌 Upcoming Events</h3>
        {upcoming.length === 0 ? (
          <Card><span style={{ color: '#555', fontSize: 12 }}>No upcoming events</span></Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcoming.map(ev => (
              <Card key={ev.id} style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 10, background: '#1e1e2a',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#6ea8fe' }}>
                    {new Date(ev.event_date).getDate()}
                  </span>
                  <span style={{ fontSize: 8, color: '#888', textTransform: 'uppercase' }}>
                    {new Date(ev.event_date).toLocaleDateString('en', { month: 'short' })}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{ev.title}</div>
                  {ev.event_time && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>🕐 {ev.event_time.slice(0, 5)}</div>}
                  {ev.description && <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{ev.description}</div>}
                </div>
                {staff && <button onClick={() => onDelete(ev.id)} style={{ background: 'none', border: 'none', color: '#f07070', fontSize: 11, cursor: 'pointer', opacity: 0.4 }}>✕</button>}
              </Card>
            ))}
          </div>
        )}
      </Fade>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Event">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Event title" />
          <Input value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Description (optional)" />
          <div style={{ display: 'flex', gap: 10 }}>
            <Input type="date" value={form.event_date} onChange={v => setForm(f => ({ ...f, event_date: v }))} style={{ flex: 1 }} />
            <Input type="time" value={form.event_time} onChange={v => setForm(f => ({ ...f, event_time: v }))} style={{ flex: 1 }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#aaa', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_milestone} onChange={e => setForm(f => ({ ...f, is_milestone: e.target.checked }))} />
            🏁 This is a milestone
          </label>
          <Btn variant="primary" onClick={handleCreate} disabled={!form.title || !form.event_date}>Create</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════
// CREW PAGE
// ═══════════════════════════════════════════

function CrewPage({ profiles, user }) {
  const admin = user.role === 'admin'
  const [editUser, setEditUser] = useState(null)
  const [editRole, setEditRole] = useState('')
  const [editDept, setEditDept] = useState('')

  const grouped = {}
  DEPTS.forEach(d => grouped[d.id] = [])
  grouped['staff'] = []
  grouped['unassigned'] = []
  profiles.forEach(p => {
    if (isStaff(p.role)) grouped['staff'].push(p)
    else if (p.department && grouped[p.department]) grouped[p.department].push(p)
    else grouped['unassigned'].push(p)
  })

  const handleSaveRole = async () => {
    if (!editUser) return
    await updateProfileRole(editUser.id, editRole, editDept || null)
    setEditUser(null)
    window.location.reload() // simplest refresh
  }

  const sections = [
    { key: 'staff', label: '👨‍🏫 Staff', items: grouped.staff },
    ...DEPTS.map(d => ({ key: d.id, label: `${d.icon} ${d.label}`, items: grouped[d.id] })),
    { key: 'unassigned', label: '❓ Unassigned', items: grouped.unassigned },
  ].filter(s => s.items.length > 0)

  return (
    <div>
      <Fade><h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>👥 Crew</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 24 }}>{profiles.length} members</p></Fade>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {sections.map((sec, si) => (
          <Fade key={sec.key} delay={si * 40}>
            <Card>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, display: 'flex', justifyContent: 'space-between' }}>
                <span>{sec.label}</span>
                <span style={{ fontSize: 11, color: '#555' }}>{sec.items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sec.items.map(member => (
                  <MemberRow key={member.id} member={member} admin={admin}
                    onEdit={() => { setEditUser(member); setEditRole(member.role); setEditDept(member.department || '') }} />
                ))}
              </div>
            </Card>
          </Fade>
        ))}
      </div>

      {/* Edit Role Modal (admin only) */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Edit Role — ${editUser?.full_name}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Select value={editRole} onChange={setEditRole}
            options={[
              { value: 'admin', label: 'Admin' },
              { value: 'docente', label: 'Docente' },
              { value: 'coordinatore', label: 'Coordinatore' },
              { value: 'studente', label: 'Studente' },
            ]} placeholder="Select role" />
          {editRole === 'studente' && (
            <Select value={editDept} onChange={setEditDept}
              options={DEPTS.map(d => ({ value: d.id, label: `${d.icon} ${d.label}` }))} placeholder="Department" />
          )}
          <Btn variant="primary" onClick={handleSaveRole}>Save</Btn>
        </div>
      </Modal>
    </div>
  )
}

function MemberRow({ member, admin, onEdit }) {
  const [h, setH] = useState(false)
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
        background: h ? '#1a1a28' : 'transparent', transition: 'all 0.12s ease',
      }}>
      <Av name={member.full_name} size={32} url={member.avatar_url} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 600 }}>{member.full_name}</div>
        <div style={{ fontSize: 10, color: '#666' }}>{member.role}</div>
      </div>
      {admin && h && (
        <button onClick={onEdit} style={{ background: 'none', border: 'none', color: '#6ea8fe', fontSize: 11, cursor: 'pointer' }}>Edit</button>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// NOTIFICATIONS PANEL
// ═══════════════════════════════════════════

function NotificationsPanel({ notifications, onMarkRead, onMarkAllRead, onClose }) {
  const unread = notifications.filter(n => !n.read)
  return (
    <div style={{
      position: 'absolute', top: 48, right: 0, width: 340,
      background: '#15151e', border: '1px solid #2a2a3a', borderRadius: 14,
      boxShadow: '0 12px 40px rgba(0,0,0,0.4)', zIndex: 50, overflow: 'hidden',
      animation: 'fadeIn 0.15s ease',
    }}>
      <div style={{ padding: '14px 18px', borderBottom: '1px solid #1e1e2a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>🔔 Notifications</span>
        {unread.length > 0 && (
          <button onClick={onMarkAllRead} style={{ background: 'none', border: 'none', color: '#6ea8fe', fontSize: 11, cursor: 'pointer' }}>Mark all read</button>
        )}
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {notifications.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#555', fontSize: 12 }}>No notifications</div>
        ) : (
          notifications.slice(0, 20).map(n => (
            <div key={n.id} onClick={() => onMarkRead(n.id)}
              style={{
                padding: '12px 18px', borderBottom: '1px solid #1a1a24', cursor: 'pointer',
                background: n.read ? 'transparent' : '#6ea8fe08',
              }}>
              <div style={{ fontSize: 12, fontWeight: n.read ? 400 : 600, marginBottom: 2 }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 11, color: '#666' }}>{n.body}</div>}
              <div style={{ fontSize: 10, color: '#444', marginTop: 4 }}>{new Date(n.created_at).toLocaleString('it')}</div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════

export default function App() {
  // Auth state
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Data
  const [profiles, setProfiles] = useState([])
  const [shots, setShots] = useState([])
  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [notifications, setNotifications] = useState([])

  // UI
  const [view, setView] = useState('overview')
  const [showNotif, setShowNotif] = useState(false)

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadUser(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) loadUser(session.user.id)
      else { setUser(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadUser = async (userId) => {
    const profile = await getProfile(userId)
    setUser(profile)
    setLoading(false)
    loadData(userId)
  }

  // ── Load all data ──
  const loadData = async (userId) => {
    const [p, sh, t, ev, n] = await Promise.all([
      getAllProfiles(),
      getShots(),
      getTasks(),
      getCalendarEvents(),
      getNotifications(userId),
    ])
    setProfiles(p)
    setShots(sh)
    setTasks(t)
    setEvents(ev)
    setNotifications(n)
  }

  // ── Realtime ──
  useEffect(() => {
    if (!user) return
    const channels = [
      subscribeToTable('shots', () => getShots().then(setShots)),
      subscribeToTable('tasks', () => getTasks().then(setTasks)),
      subscribeToTable('notifications', () => getNotifications(user.id).then(setNotifications)),
    ]
    return () => channels.forEach(ch => supabase.removeChannel(ch))
  }, [user])

  // ── Handlers ──
  const handleCreateShot = async (shot) => { await createShot(shot); setShots(await getShots()) }
  const handleUpdateShot = async (id, updates) => { await updateShot(id, updates); setShots(await getShots()) }
  const handleDeleteShot = async (id) => { await deleteShot(id); setShots(await getShots()) }

  const handleCreateTask = async (task) => {
    const { data } = await createTask(task)
    if (data && task.assigned_to) {
      await sendNotification(task.assigned_to, 'task_assigned', 'New task assigned', task.title, 'task', data.id)
    }
    setTasks(await getTasks())
  }
  const handleUpdateTask = async (id, updates) => {
    await updateTask(id, updates)
    const task = tasks.find(t => t.id === id)
    // Notify on status changes
    if (updates.status === 'review' && task?.assigned_to) {
      const staffMembers = profiles.filter(p => isStaff(p.role))
      for (const s of staffMembers) {
        await sendNotification(s.id, 'task_review', 'Task submitted for review', task.title, 'task', id)
      }
    }
    if (updates.status === 'approved' && task?.assigned_to) {
      await sendNotification(task.assigned_to, 'task_approved', 'Task approved! ✓', task.title, 'task', id)
    }
    if (updates.status === 'wip' && task?.status === 'review' && task?.assigned_to) {
      await sendNotification(task.assigned_to, 'task_revision', 'Changes requested', task.title, 'task', id)
    }
    setTasks(await getTasks())
  }
  const handleDeleteTask = async (id) => { await deleteTask(id); setTasks(await getTasks()) }
  const handleAddComment = async (taskId, authorId, body) => {
    const result = await addComment(taskId, authorId, body)
    const task = tasks.find(t => t.id === taskId)
    // Notify the other party
    if (task) {
      if (authorId !== task.assigned_to && task.assigned_to) {
        await sendNotification(task.assigned_to, 'comment', 'New comment on your task', body.slice(0, 80), 'task', taskId)
      }
      if (isStaff(user.role) === false) {
        const staffMembers = profiles.filter(p => isStaff(p.role))
        for (const s of staffMembers) {
          if (s.id !== authorId) await sendNotification(s.id, 'comment', `Comment from ${user.full_name}`, body.slice(0, 80), 'task', taskId)
        }
      }
    }
    return result
  }

  const handleCreateEvent = async (ev) => { await createCalendarEvent(ev); setEvents(await getCalendarEvents()) }
  const handleDeleteEvent = async (id) => { await deleteCalendarEvent(id); setEvents(await getCalendarEvents()) }

  const handleMarkRead = async (id) => { await markNotificationRead(id); setNotifications(await getNotifications(user.id)) }
  const handleMarkAllRead = async () => { await markAllNotificationsRead(user.id); setNotifications(await getNotifications(user.id)) }

  // ── Loading / Login ──
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0e0e14', color: '#555' }}>Loading...</div>
  if (!session || !user) return <LoginPage />

  const unreadCount = notifications.filter(n => !n.read).length

  const nav = [
    { id: 'overview', icon: '🏠', label: 'Overview' },
    { id: 'shots', icon: '🎬', label: 'Shots' },
    { id: 'tasks', icon: '📋', label: 'Tasks' },
    { id: 'storyboard', icon: '🗂', label: 'Storyboard' },
    { id: 'calendar', icon: '📅', label: 'Calendar' },
    { id: 'crew', icon: '👥', label: 'Crew' },
  ]

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <div style={{
        width: 220, background: '#111118', borderRight: '1px solid #1c1c26',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: 'sticky', top: 0, height: '100vh',
      }}>
        <div style={{ padding: '22px 18px 20px', borderBottom: '1px solid #1c1c26' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg, #6ea8fe, #b07ce8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
            }}>BR</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>BigRock Studios</div>
              <div style={{ fontSize: 10, color: '#555' }}>Production Pipeline</div>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 0', flex: 1 }}>
          {nav.map(n => <NavBtn key={n.id} icon={n.icon} label={n.label} active={view === n.id} onClick={() => setView(n.id)} />)}
        </div>

        <div style={{ padding: '14px 18px', borderTop: '1px solid #1c1c26' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Av name={user.full_name} size={28} url={user.avatar_url} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.full_name}</div>
              <div style={{ fontSize: 9, color: '#555' }}>{user.role}</div>
            </div>
          </div>
          <button onClick={signOut}
            style={{ marginTop: 10, width: '100%', background: '#1e1e2a', border: '1px solid #2a2a3a', borderRadius: 8, padding: '6px 0', color: '#888', fontSize: 11, cursor: 'pointer' }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          height: 56, borderBottom: '1px solid #1c1c26',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px', background: '#0e0e14', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{nav.find(n => n.id === view)?.icon} {nav.find(n => n.id === view)?.label}</span>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowNotif(!showNotif)}
              style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: 4, position: 'relative' }}>
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: '50%',
                  background: '#f07070', color: '#fff', fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{unreadCount}</span>
              )}
            </button>
            {showNotif && <NotificationsPanel notifications={notifications} onMarkRead={handleMarkRead}
              onMarkAllRead={handleMarkAllRead} onClose={() => setShowNotif(false)} />}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px 28px', flex: 1 }} onClick={() => showNotif && setShowNotif(false)}>
          {view === 'overview' && <OverviewPage shots={shots} tasks={tasks} profiles={profiles} user={user} onNav={setView} />}
          {view === 'shots' && <ShotTrackerPage shots={shots} user={user} onUpdateShot={handleUpdateShot} onCreateShot={handleCreateShot} onDeleteShot={handleDeleteShot} />}
          {view === 'tasks' && <TasksPage tasks={tasks} shots={shots} profiles={profiles} user={user} onCreateTask={handleCreateTask} onUpdateTask={handleUpdateTask} onDeleteTask={handleDeleteTask} onAddComment={handleAddComment} />}
          {view === 'storyboard' && <StoryboardPage />}
          {view === 'calendar' && <CalendarPage events={events} user={user} onCreate={handleCreateEvent} onDelete={handleDeleteEvent} />}
          {view === 'crew' && <CrewPage profiles={profiles} user={user} />}
        </div>
      </div>
    </div>
  )
}
