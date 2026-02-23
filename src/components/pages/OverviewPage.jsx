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

  return (
    <div>
      <Fade>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px' }}>Ciao {user.full_name.split(' ')[0]} {user.mood_emoji || '👋'}</h1>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 28 }}>Production Pipeline Overview</p>
      </Fade>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { l: 'Shots', v: shots.length, e: '🎬', c: '#7c5cfc' },
          { l: 'Completati', v: done, e: '✅', c: '#4ecdc4' },
          { l: 'In Corso', v: wip, e: '🔧', c: '#f0c36d' },
          { l: isStaff(user.role) ? 'Da Revisionare' : 'I Miei Task', v: isStaff(user.role) ? reviewTasks.length : myTasks.length, e: '📋', c: '#ff8e53' },
        ].map((s, i) => (
          <Fade key={s.l} delay={i * 50}>
            <Card accent={s.c}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>{s.e} {s.l}</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{s.v}</div>
            </Card>
          </Fade>
        ))}
      </div>

      <Fade delay={200}>
        <Card style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>📊 Progresso Pipeline</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: '#7c5cfc' }}>{pct}%</span>
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
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>🏗 Dipartimenti</div>
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
                    <span style={{ fontSize: 13 }}>{dept.icon} {dept.label}</span>
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
