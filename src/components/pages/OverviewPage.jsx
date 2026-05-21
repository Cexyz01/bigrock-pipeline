import { DEPTS, SHOT_DEPT_IDS, ASSET_DEPT_IDS, TASK_STATUSES, isDeptEnabled } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import Fade from '../ui/Fade'
import Card from '../ui/Card'
import Bar from '../ui/Bar'

// Project-wide overview. Intentionally NOT personalized — no "my tasks" or
// per-user breakdowns. Everything here describes the state of the project
// itself so the page reads the same for any viewer.
export default function OverviewPage({ shots, assets = [], tasks, profiles = [], currentProject }) {
  const isMobile = useIsMobile()

  // Task-based metrics — every KPI on this page uses the same unit (tasks)
  // so the cards can be compared at a glance.
  const total = tasks.length
  const todo = tasks.filter(t => t.status === 'todo').length
  const wip = tasks.filter(t => t.status === 'wip').length
  const review = tasks.filter(t => t.status === 'review').length
  const done = tasks.filter(t => t.status === 'approved').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  // Status breakdown for the progress bar legend — drives off TASK_STATUSES
  // so colors/labels stay in sync with the rest of the app.
  const statusCounts = { todo, wip, review, approved: done }

  // Top-line KPIs (all task-based, all project-wide).
  const kpis = [
    { label: 'Task in Review', value: review,            color: '#F28C28' },
    { label: 'In corso',       value: wip,               color: '#2563EB' },
    { label: 'Completati',     value: `${done} / ${total}`, color: '#10B981' },
  ]

  // Project meta strip — counts of entities (shots/assets/team) live here
  // as INFORMATION, not as KPI cards. This is the fix for the previous
  // header that mixed entity counts with task statuses in the same row.
  const metaBits = [
    { icon: '🎬', label: `${shots.length} shots` },
    { icon: '🧊', label: `${assets.length} assets` },
    { icon: '👥', label: `${profiles.length} ${profiles.length === 1 ? 'persona' : 'persone'}` },
    currentProject?.start_date && { icon: '📅', label: `dal ${formatStart(currentProject.start_date)}` },
  ].filter(Boolean)

  return (
    <div>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <Fade>
        <div style={{ marginBottom: isMobile ? 20 : 28 }}>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 700, margin: 0, color: '#1a1a1a', letterSpacing: '-0.01em' }}>
            {currentProject?.name || 'Overview'}
          </h1>
          {currentProject?.description && (
            <p style={{ fontSize: 14, color: '#64748B', margin: '6px 0 0', maxWidth: 720, lineHeight: 1.5 }}>
              {currentProject.description}
            </p>
          )}
          {metaBits.length > 0 && (
            <div style={{ display: 'flex', gap: isMobile ? 10 : 18, flexWrap: 'wrap', marginTop: 12 }}>
              {metaBits.map(m => (
                <span key={m.label} style={{ fontSize: 12, color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, lineHeight: 1 }}>{m.icon}</span>
                  {m.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </Fade>

      {/* ── KPI ROW ─────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : `repeat(${kpis.length}, 1fr)`,
        gap: isMobile ? 10 : 20,
        marginBottom: isMobile ? 20 : 32,
      }}>
        {kpis.map((k, i) => (
          <Fade key={k.label} delay={i * 50}>
            <div style={{
              background: '#fff', border: '1px solid #E8ECF1', borderRadius: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              padding: isMobile ? 14 : 24,
              borderLeft: `4px solid ${k.color}`,
            }}>
              <div style={{
                fontSize: isMobile ? 10 : 11, color: '#94A3B8',
                textTransform: 'uppercase', letterSpacing: '0.08em',
                fontWeight: 600, marginBottom: isMobile ? 6 : 10,
              }}>{k.label}</div>
              <div style={{
                fontSize: isMobile ? 22 : 32, fontWeight: 800, color: k.color, lineHeight: 1,
              }}>{k.value}</div>
            </div>
          </Fade>
        ))}
      </div>

      {/* ── PIPELINE PROGRESS ───────────────────────────────────── */}
      <Fade delay={200}>
        <Card style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a' }}>Pipeline Progress</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#F28C28', lineHeight: 1 }}>{pct}%</span>
          </div>
          <Bar value={pct} h={8} />
          <div style={{ display: 'flex', gap: isMobile ? 12 : 24, marginTop: 18, flexWrap: 'wrap' }}>
            {TASK_STATUSES.map(st => {
              const c = statusCounts[st.id] || 0
              return (
                <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: st.color }} />
                  <span style={{ fontSize: 13, color: '#64748B' }}>{st.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: st.color }}>{c}</span>
                </div>
              )
            })}
          </div>
        </Card>
      </Fade>

      {/* ── DEPARTMENTS (invariato) ─────────────────────────────── */}
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

// Italian-locale short date for the meta strip — "dal 12 mar 2026"
function formatStart(iso) {
  try {
    return new Date(iso).toLocaleDateString('it', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}
