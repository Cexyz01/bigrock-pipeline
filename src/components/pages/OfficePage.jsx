import { useState, useEffect, useMemo, useRef } from 'react'
import { getAllWipUpdates, subscribeToTable } from '../../lib/supabase'
import useIsMobile from '../../hooks/useIsMobile'
import Fade from '../ui/Fade'

// ─────────────────────────────────────────────────────────────────────────────
// OfficePage — "vista ufficio" solo-admin.
// Rappresentazione pixel-art dello studio: ogni reparto è una stanza, ogni
// studente è un personaggio seduto alla scrivania. I fumetti e lo stato sono
// pilotati da DATI VERI:
//   • presence live (canale admin-fx, passata da App come `onlineUsers`)
//       → personaggio acceso (seduto) vs spento (postazione vuota)
//   • task_wip_updates di OGGI  → fumetto blu "WIP"
//   • task approvati OGGI       → fumetto verde "approvato"
//   • INSERT realtime su task_wip_updates → pop "WIP!" animato in tempo reale
//   • mood_emoji del profilo    → badge fluttuante
// ─────────────────────────────────────────────────────────────────────────────

// Reparti/stanze — stessa categorizzazione di ActivityTrackerPage.
const ROOMS = [
  { id: 'concept', label: 'Concept',  color: '#E879F9' },
  { id: 'cg',      label: 'CG · 3D',  color: '#A78BFA' },
  { id: 'sound',   label: 'Sound',    color: '#14B8A6' },
  { id: 'other',   label: 'Altro',    color: '#94A3B8' },
]
const studentRoom = (s) => {
  const d = s?.department
  if (d === 'concept') return 'concept'
  if (d === 'sound') return 'sound'
  if (!d) return 'other'
  return 'cg'
}

const todayStr = () => new Date().toISOString().split('T')[0]

// Deterministic pick so a given student always gets the same look.
const hashStr = (s = '') => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
const SKINS = ['#F2C9A0', '#E8B088', '#D69A6E', '#B57A52', '#8A5A3B', '#F7D9BC']
const HAIRS = ['#2B2118', '#4A3423', '#6B4423', '#8B5A2B', '#A9744F', '#1C1C1C', '#C99A3B', '#6E6E6E']

// ── Pixel character seated at a desk ─────────────────────────────────────────
function PixelWorker({ name, shirt, online, today, mood, justPushed }) {
  const skin = SKINS[hashStr(name) % SKINS.length]
  const hair = HAIRS[hashStr(name + 'h') % HAIRS.length]
  const shirtCol = online ? shirt : '#8A93A3'
  const dim = online ? 1 : 0.42

  // Which bubble to show above the head (live pop wins).
  let bubble = null
  if (justPushed) bubble = { text: 'WIP!', bg: '#3B82F6', fg: '#fff', pop: true }
  else if (today === 'green') bubble = { text: '✓ approvato', bg: '#D1FAE5', fg: '#059669', border: '#6EE7B7' }
  else if (today === 'blue') bubble = { text: 'WIP', bg: '#DBEAFE', fg: '#2563EB', border: '#93C5FD' }

  return (
    <div style={{ position: 'relative', width: 116, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Bubble slot (fixed height so rows align) */}
      <div style={{ height: 26, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: 2 }}>
        {bubble && (
          <div style={{
            fontSize: 10.5, fontWeight: 700, lineHeight: 1, padding: '4px 8px', borderRadius: 8,
            background: bubble.bg, color: bubble.fg, whiteSpace: 'nowrap',
            border: bubble.border ? `1px solid ${bubble.border}` : 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
            animation: bubble.pop ? 'office-pop 0.4s ease' : 'office-float 3s ease-in-out infinite',
            position: 'relative',
          }}>
            {bubble.text}
            {/* little tail */}
            <span style={{
              position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
              width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
              borderTop: `4px solid ${bubble.bg}`,
            }} />
          </div>
        )}
      </div>

      {/* Character + desk */}
      <div style={{ position: 'relative', width: 88, height: 84 }}>
        {/* mood badge */}
        {mood && online && (
          <div style={{
            position: 'absolute', top: -2, right: 8, fontSize: 15, zIndex: 3,
            animation: 'office-float 3.5s ease-in-out infinite',
          }}>{mood}</div>
        )}
        {/* idle Zzz for offline stations */}
        {!online && (
          <div style={{ position: 'absolute', top: 0, right: 12, fontSize: 12, color: '#64748B', fontWeight: 700, zIndex: 3 }}>z</div>
        )}
        {/* live ping ring */}
        {justPushed && (
          <div style={{
            position: 'absolute', top: 6, left: '50%', width: 60, height: 60,
            marginLeft: -30, borderRadius: '50%', border: '2px solid #3B82F6',
            animation: 'office-ping 1s ease-out infinite', zIndex: 0,
          }} />
        )}

        {/* pixel bust */}
        <svg viewBox="0 0 32 34" width={70} height={74} shapeRendering="crispEdges"
          style={{ position: 'absolute', top: 0, left: '50%', marginLeft: -35, opacity: dim, zIndex: 1 }}>
          {/* shoulders / shirt */}
          <rect x="3" y="24" width="26" height="10" rx="2" fill={shirtCol} />
          <rect x="3" y="24" width="26" height="2" fill="rgba(255,255,255,0.12)" />
          {/* neck */}
          <rect x="13" y="21" width="6" height="4" fill={skin} />
          {/* head */}
          <rect x="8" y="7" width="16" height="15" rx="1" fill={skin} />
          {/* ears */}
          <rect x="6" y="13" width="2" height="3" fill={skin} />
          <rect x="24" y="13" width="2" height="3" fill={skin} />
          {/* hair: top + fringe + sides */}
          <rect x="7" y="4" width="18" height="7" fill={hair} />
          <rect x="8" y="7" width="16" height="3" fill={hair} />
          <rect x="7" y="7" width="2" height="7" fill={hair} />
          <rect x="23" y="7" width="2" height="7" fill={hair} />
          {/* eyes */}
          <rect x="11" y="13" width="2.6" height="3" fill="#26201c" />
          <rect x="18.4" y="13" width="2.6" height="3" fill="#26201c" />
        </svg>

        {/* desk */}
        <div style={{
          position: 'absolute', bottom: 0, left: 2, right: 2, height: 26,
          background: 'linear-gradient(#3a4353, #2a313d)', borderRadius: 6,
          border: '1px solid #1c222c', zIndex: 2,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}>
          {/* monitor */}
          <div style={{
            position: 'absolute', top: -12, left: '50%', marginLeft: -14, width: 28, height: 18,
            background: '#11151c', borderRadius: 3, border: '1px solid #0a0d12',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 22, height: 12, borderRadius: 1,
              background: online ? shirt : '#3a4150',
              boxShadow: online ? `0 0 8px ${shirt}` : 'none',
              opacity: online ? 0.9 : 0.5,
            }} />
          </div>
        </div>
      </div>

      {/* nameplate */}
      <div style={{
        marginTop: 6, fontSize: 11, fontWeight: 600, color: online ? '#E2E8F0' : '#64748B',
        maxWidth: 108, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {name}
      </div>
    </div>
  )
}

// ── One room (department) ────────────────────────────────────────────────────
function Room({ room, students, onlineIds, statusByUser, justPushedIds }) {
  const onlineCount = students.filter(s => onlineIds.has(s.id)).length
  return (
    <div style={{
      background: '#171b24', border: `1px solid ${room.color}33`, borderRadius: 14,
      padding: 14, minWidth: 260, flex: '1 1 300px',
    }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ width: 9, height: 9, borderRadius: 2, background: room.color, boxShadow: `0 0 8px ${room.color}` }} />
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: '#CBD5E1' }}>{room.label}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 10.5, color: '#64748B', fontWeight: 600 }}>
          <span style={{ color: onlineCount > 0 ? '#34D399' : '#64748B' }}>{onlineCount}</span>/{students.length} online
        </span>
      </div>

      {/* floor */}
      <div style={{
        background: '#0f1219', borderRadius: 10, padding: '16px 12px 12px', minHeight: 120,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
      }}>
        {students.length === 0 ? (
          <div style={{ color: '#475569', fontSize: 12, textAlign: 'center', padding: '24px 0' }}>Nessuno assegnato</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
            {students.map(s => (
              <PixelWorker
                key={s.id}
                name={s.full_name || 'Studente'}
                shirt={room.color}
                online={onlineIds.has(s.id)}
                today={statusByUser[s.id] || 'none'}
                mood={s.mood_emoji}
                justPushed={justPushedIds.has(s.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function OfficePage({ tasks = [], profiles = [], projectMembers, user, currentProject, onlineUsers = [] }) {
  const isMobile = useIsMobile()
  const [allWips, setAllWips] = useState([])
  const [justPushed, setJustPushed] = useState({}) // userId -> expiry ts
  const timersRef = useRef({})

  // Load today's WIP updates.
  useEffect(() => {
    getAllWipUpdates()
      .then(d => setAllWips(d || []))
      .catch(e => { console.warn('[office] getAllWipUpdates failed:', e?.message || e); setAllWips([]) })
  }, [])

  // Realtime: a new WIP → refresh + pop that character.
  useEffect(() => {
    const ch = subscribeToTable('task_wip_updates', (payload) => {
      getAllWipUpdates().then(d => setAllWips(d || [])).catch(() => {})
      const uid = payload?.new?.user_id
      if (!uid) return
      setJustPushed(p => ({ ...p, [uid]: Date.now() + 6000 }))
      clearTimeout(timersRef.current[uid])
      timersRef.current[uid] = setTimeout(() => {
        setJustPushed(p => { const n = { ...p }; delete n[uid]; return n })
      }, 6000)
    })
    return () => { ch?.unsubscribe?.(); Object.values(timersRef.current).forEach(clearTimeout) }
  }, [])

  // Students of the current project, department overridden by project_role
  // (same rule as ActivityTrackerPage / TasksPage).
  const students = useMemo(() => {
    const memberByUser = new Map((projectMembers || []).map(m => [m.user_id, m]))
    return profiles
      .filter(p => p.role_slug === 'studente' && (projectMembers ? memberByUser.has(p.id) : true))
      .map(p => {
        const m = memberByUser.get(p.id)
        return m ? { ...p, department: m.project_role || p.department || null } : p
      })
  }, [profiles, projectMembers])

  // Online set from presence (all users tracked on admin-fx).
  const onlineIds = useMemo(() => new Set((onlineUsers || []).map(u => u.user_id)), [onlineUsers])

  // Today's status per student: green (approved today) > blue (wip today) > none.
  const statusByUser = useMemo(() => {
    const today = todayStr()
    const out = {}
    for (const w of allWips) {
      if (w.created_at?.split('T')[0] === today && w.user_id) {
        if (out[w.user_id] !== 'green') out[w.user_id] = 'blue'
      }
    }
    for (const t of tasks) {
      if (t.status === 'approved' && t.updated_at?.split('T')[0] === today) {
        for (const a of (t.assignees || [])) out[a.user.id] = 'green'
      }
    }
    return out
  }, [allWips, tasks])

  const justPushedIds = useMemo(() => new Set(Object.keys(justPushed)), [justPushed])

  // Group students by room; always render the 3 core rooms, "Altro" only if used.
  const rooms = useMemo(() => {
    const byRoom = { concept: [], cg: [], sound: [], other: [] }
    for (const s of students) byRoom[studentRoom(s)].push(s)
    return ROOMS.filter(r => r.id !== 'other' || byRoom.other.length > 0)
      .map(r => ({ room: r, students: byRoom[r.id] }))
  }, [students])

  const totalOnlineStudents = students.filter(s => onlineIds.has(s.id)).length
  const activeToday = Object.keys(statusByUser).length

  return (
    <div>
      <style>{`
        @keyframes office-float { 0%,100%{ transform: translateY(0) } 50%{ transform: translateY(-3px) } }
        @keyframes office-pop { 0%{ transform: scale(0.4); opacity:0 } 60%{ transform: scale(1.15) } 100%{ transform: scale(1); opacity:1 } }
        @keyframes office-ping { 0%{ transform: scale(0.5); opacity:0.7 } 100%{ transform: scale(1.4); opacity:0 } }
        @keyframes office-live { 0%,100%{ opacity:1 } 50%{ opacity:0.35 } }
      `}</style>

      {/* Header */}
      <Fade>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'flex-end', marginBottom: 20, gap: 8 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' }}>Studio</h1>
            <p style={{ fontSize: 14, color: '#64748B', margin: 0 }}>
              Vista ufficio in tempo reale{currentProject ? ` · ${currentProject.name}` : ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#059669' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'office-live 1.6s ease-in-out infinite' }} />
              LIVE
            </span>
            <span style={{ fontSize: 12, color: '#64748B' }}><b style={{ color: '#1a1a1a' }}>{totalOnlineStudents}</b> online</span>
            <span style={{ fontSize: 12, color: '#64748B' }}><b style={{ color: '#1a1a1a' }}>{activeToday}</b> attivi oggi</span>
          </div>
        </div>
      </Fade>

      {/* The studio board (dark) */}
      <Fade delay={60}>
        <div style={{
          background: 'linear-gradient(160deg, #1c2029, #12151c)', borderRadius: 18, padding: isMobile ? 14 : 20,
          border: '1px solid #262d38', boxShadow: '0 10px 40px rgba(0,0,0,0.18)',
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {rooms.map(({ room, students }) => (
              <Room
                key={room.id}
                room={room}
                students={students}
                onlineIds={onlineIds}
                statusByUser={statusByUser}
                justPushedIds={justPushedIds}
              />
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, marginTop: 18, paddingTop: 14, borderTop: '1px solid #262d38' }}>
            {[
              { c: '#3B82F6', label: 'WIP caricato oggi' },
              { c: '#10B981', label: 'Task approvato oggi' },
              { c: '#A78BFA', label: 'Seduto = online ora' },
              { c: '#475569', label: 'Postazione vuota = offline' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: l.c }} />
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </Fade>
    </div>
  )
}
