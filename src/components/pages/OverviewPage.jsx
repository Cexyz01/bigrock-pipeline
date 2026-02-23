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

  // Dept color map for stat cards
  const statCards = [
    { l: 'Shots', v: shots.length, c: '#60A5FA' },
    { l: 'Completati', v: done, c: '#10B981' },
    { l: 'In Corso', v: wip, c: '#F59E0B' },
    { l: isStaff(user.role) ? 'Da Revisionare' : 'I Miei Task', v: isStaff(user.role) ? reviewTasks.length : myTasks.length, c: '#6C5CE7' },
  ]

  return (
    <div>
      <Fade>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a2e' }}>Ciao {user.full_name.split(' ')[0]} {user.mood_emoji || ''}</h1>
        <p style={{ fontSize: 14, color: '#64748B', marginBottom: 32 }}>Production Pipeline Overview</p>
      </Fade>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20, marginBottom: 32 }}>
        {statCards.map((s, i) => (
          <Fade key={s.l} delay={i * 50}>
            <div style={{
              background: '#fff', border: '1px solid #E8ECF1', borderRadius: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: 24,
              borderLeft: `4px solid ${s.c}`,
            }}>
              <div style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>{s.l}</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: s.c }}>{s.v}</div>
            </div>
          </Fade>
        ))}
      </div>

      <Fade delay={200}>
        <Card style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a2e' }}>Progresso Pipeline</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#6C5CE7' }}>{pct}%</span>
          </div>
          <Bar value={pct} h={8} />
          <div style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap' }}>
            {SHOT_STATUSES.map(st => {
              const c = shots.reduce((s, sh) => s + DEPTS.filter(d => sh[`status_${d.id}`] === st.id).length, 0)
              return (
                <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: st.color }} />
                  <span style={{ fontSize: 13, color: '#64748B' }}>{st.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: st.color }}>{c}</span>
                </div>
              )
            })}
          </div>
        </Card>
      </Fade>

      <Fade delay={300}>
        <Card>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: '#1a1a2e' }}>Dipartimenti</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {DEPTS.map(dept => {
              const t = shots.length
              const d = shots.filter(sh => sh[`status_${dept.id}`] === 'approved').length
              // #11: Tasks count only for THIS department
              const deptTasks = tasks.filter(tk => tk.department === dept.id)
              const deptDone = deptTasks.filter(tk => tk.status === 'approved').length
              return (
                <div key={dept.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#1a1a2e' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: dept.color, display: 'inline-block' }} />
                      {dept.label}
                    </span>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                      {d}/{t} shots · {deptDone}/{deptTasks.length} tasks
                    </span>
                  </div>
                  <Bar value={t > 0 ? Math.round((d / t) * 100) : 0} h={5} />
                </div>
              )
            })}
          </div>
        </Card>
      </Fade>
    </div>
  )
}
