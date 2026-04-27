import { DEPTS, SHOT_DEPT_IDS, ASSET_DEPT_IDS, SHOT_STATUSES, hasPermission, isDeptEnabled } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import Fade from '../ui/Fade'
import Card from '../ui/Card'
import Bar from '../ui/Bar'

export default function OverviewPage({ shots, assets = [], tasks, profiles, user, currentProject }) {
  const isMobile = useIsMobile()

  // Count cells across both shots and assets, respecting which depts apply to each entity
  const countCells = (entities, deptIds, predicate) => entities.reduce(
    (sum, e) => sum + deptIds.filter(id => isDeptEnabled(e, id) && predicate(e[`status_${id}`])).length,
    0,
  )
  const anyStatus = () => true
  const total = countCells(shots, SHOT_DEPT_IDS, anyStatus) + countCells(assets, ASSET_DEPT_IDS, anyStatus)
  const done = countCells(shots, SHOT_DEPT_IDS, st => st === 'approved' || st === 'review')
            + countCells(assets, ASSET_DEPT_IDS, st => st === 'approved' || st === 'review')
  const wip  = countCells(shots, SHOT_DEPT_IDS, st => st === 'in_progress')
            + countCells(assets, ASSET_DEPT_IDS, st => st === 'in_progress')
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const myTasks = tasks.filter(t => t.assigned_to === user.id)
  const reviewTasks = tasks.filter(t => t.status === 'review')

  // Dept color map for stat cards
  const statCards = [
    { l: 'Shots', v: shots.length, c: '#1a1a1a' },
    { l: 'Assets', v: assets.length, c: '#1a1a1a' },
    { l: 'Completed', v: done, c: '#10B981' },
    { l: 'In Progress', v: wip, c: '#2563EB' },
    { l: hasPermission(user, 'access_review') ? 'To Review' : 'My Tasks', v: hasPermission(user, 'access_review') ? reviewTasks.length : myTasks.length, c: '#F28C28' },
  ]

  return (
    <div>
      <Fade>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' }}>Hi {user.full_name.split(' ')[0]} {user.mood_emoji || ''}</h1>
        {currentProject && (
          <div style={{ marginTop: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#1a1a1a' }}>{currentProject.name}</div>
            {currentProject.description && <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{currentProject.description}</div>}
            {currentProject.start_date && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Inizio: {currentProject.start_date}</div>}
          </div>
        )}
        <p style={{ fontSize: 14, color: '#64748B', marginBottom: 32 }}>BigRock Hub Overview</p>
      </Fade>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${statCards.length}, 1fr)`, gap: isMobile ? 12 : 20, marginBottom: isMobile ? 20 : 32 }}>
        {statCards.map((s, i) => (
          <Fade key={s.l} delay={i * 50}>
            <div style={{
              background: '#fff', border: '1px solid #E8ECF1', borderRadius: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)', padding: isMobile ? 16 : 24,
              borderLeft: `4px solid ${s.c}`,
            }}>
              <div style={{ fontSize: isMobile ? 11 : 13, color: '#64748B', marginBottom: isMobile ? 6 : 12 }}>{s.l}</div>
              <div style={{ fontSize: isMobile ? 24 : 32, fontWeight: 700, color: s.c }}>{s.v}</div>
            </div>
          </Fade>
        ))}
      </div>

      <Fade delay={200}>
        <Card style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>Pipeline Progress</span>
            <span style={{ fontSize: 24, fontWeight: 700, color: '#F28C28' }}>{pct}%</span>
          </div>
          <Bar value={pct} h={8} />
          <div style={{ display: 'flex', gap: 20, marginTop: 20, flexWrap: 'wrap' }}>
            {SHOT_STATUSES.map(st => {
              const c = countCells(shots, SHOT_DEPT_IDS, s => s === st.id)
                      + countCells(assets, ASSET_DEPT_IDS, s => s === st.id)
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
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: '#1a1a1a' }}>Departments</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {DEPTS.map(dept => {
              const onShots = SHOT_DEPT_IDS.includes(dept.id)
              const onAssets = ASSET_DEPT_IDS.includes(dept.id)
              const isDone = st => st === 'approved' || st === 'review'
              const shotsT = onShots ? shots.filter(sh => isDeptEnabled(sh, dept.id)).length : 0
              const shotsD = onShots ? shots.filter(sh => isDeptEnabled(sh, dept.id) && isDone(sh[`status_${dept.id}`])).length : 0
              const assetsT = onAssets ? assets.filter(a => isDeptEnabled(a, dept.id)).length : 0
              const assetsD = onAssets ? assets.filter(a => isDeptEnabled(a, dept.id) && isDone(a[`status_${dept.id}`])).length : 0
              const t = shotsT + assetsT
              const d = shotsD + assetsD
              // Tasks count only for THIS department
              const deptTasks = tasks.filter(tk => tk.department === dept.id)
              const deptDone = deptTasks.filter(tk => tk.status === 'approved' || tk.status === 'review').length

              const parts = []
              if (onShots) parts.push(`${shotsD}/${shotsT} shots`)
              if (onAssets) parts.push(`${assetsD}/${assetsT} assets`)
              parts.push(`${deptDone}/${deptTasks.length} tasks`)

              return (
                <div key={dept.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#1a1a1a' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: dept.color, display: 'inline-block' }} />
                      {dept.label}
                    </span>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                      {parts.join(' · ')}
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
