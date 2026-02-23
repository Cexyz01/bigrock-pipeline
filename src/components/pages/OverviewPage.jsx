import { DEPTS, SHOT_STATUSES, isStaff } from '../../lib/constants'
import Fade from '../ui/Fade'
import Card from '../ui/Card'
import Bar from '../ui/Bar'

export default function OverviewPage({ shots, tasks, profiles, user }) {
  const total = shots.length * DEPTS.length
  const done = shots.reduce((s, sh) => s + DEPTS.filter(d => sh[`status_${d.id}`] === 'approved').length, 0)
  const wip = shots.reduce((s, sh) => s + DEPTS.filter(d => sh[`status_${d.id}`] === 'in_progress').length, 0)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const myTasks = tasks.filter(t => t.assigned_to === user.id)
  const reviewTasks = tasks.filter(t => t.status === 'review')

  // Colored stat cards with themed backgrounds
  const statCards = [
    { l: 'Shots', v: shots.length, e: '🎬', c: '#CDFF00', bg: 'rgba(205,255,0,0.06)', border: 'rgba(205,255,0,0.18)' },
    { l: 'Completati', v: done, e: '✅', c: '#4ECDC4', bg: 'rgba(78,205,196,0.06)', border: 'rgba(78,205,196,0.18)' },
    { l: 'In Corso', v: wip, e: '🔧', c: '#FF6B4A', bg: 'rgba(255,107,74,0.06)', border: 'rgba(255,107,74,0.18)' },
    { l: isStaff(user.role) ? 'Da Revisionare' : 'I Miei Task', v: isStaff(user.role) ? reviewTasks.length : myTasks.length, e: '📋', c: '#C4A8FF', bg: 'rgba(196,168,255,0.06)', border: 'rgba(196,168,255,0.18)' },
  ]

  return (
    <div>
      <Fade>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px', color: '#f0f0f5' }}>Ciao {user.full_name.split(' ')[0]} {user.mood_emoji || '👋'}</h1>
        <p style={{ fontSize: 14, color: '#555', marginBottom: 28 }}>Production Pipeline Overview</p>
      </Fade>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {statCards.map((s, i) => (
          <Fade key={s.l} delay={i * 50}>
            <Card style={{ background: s.bg, border: `1px solid ${s.border}` }} accent={s.c}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>{s.e} {s.l}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.c }}>{s.v}</div>
            </Card>
          </Fade>
        ))}
      </div>

      <Fade delay={200}>
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f5' }}>📊 Progresso Pipeline</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#CDFF00' }}>{pct}%</span>
          </div>
          <Bar value={pct} h={7} />
          <div style={{ display: 'flex', gap: 18, marginTop: 16, flexWrap: 'wrap' }}>
            {SHOT_STATUSES.map(st => {
              const c = shots.reduce((s, sh) => s + DEPTS.filter(d => sh[`status_${d.id}`] === st.id).length, 0)
              return (
                <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.color }} />
                  <span style={{ fontSize: 12, color: '#777' }}>{st.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: st.color }}>{c}</span>
                </div>
              )
            })}
          </div>
        </Card>
      </Fade>

      <Fade delay={300}>
        <Card>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#f0f0f5' }}>🏗 Dipartimenti</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {DEPTS.map(dept => {
              const t = shots.length
              const d = shots.filter(sh => sh[`status_${dept.id}`] === 'approved').length
              // #11: Tasks count only for THIS department
              const deptTasks = tasks.filter(tk => tk.department === dept.id)
              const deptDone = deptTasks.filter(tk => tk.status === 'approved').length
              return (
                <div key={dept.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: '#f0f0f5' }}>{dept.icon} {dept.label}</span>
                    <span style={{ fontSize: 12, color: '#777', fontWeight: 600 }}>
                      {d}/{t} shots · {deptDone}/{deptTasks.length} tasks
                    </span>
                  </div>
                  <Bar value={t > 0 ? Math.round((d / t) * 100) : 0} h={4} />
                </div>
              )
            })}
          </div>
        </Card>
      </Fade>
    </div>
  )
}
