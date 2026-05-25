import { useState } from 'react'
import { DEPTS, SHOT_DEPT_IDS, ASSET_DEPT_IDS, TASK_STATUSES, isDeptEnabled, hasPermission, isAdmin } from '../../lib/constants'
import { updateProject } from '../../lib/supabase'
import useIsMobile from '../../hooks/useIsMobile'
import Fade from '../ui/Fade'
import Card from '../ui/Card'
import Bar from '../ui/Bar'
import Btn from '../ui/Btn'
import ScrollReveal from '../ui/ScrollReveal'

// Project-wide overview. Intentionally NOT personalized — no "my tasks" or
// per-user breakdowns. Everything here describes the state of the project
// itself so the page reads the same for any viewer.
export default function OverviewPage({ shots, assets = [], tasks, profiles = [], user, currentProject }) {
  const isMobile = useIsMobile()
  const [tab, setTab] = useState('stats')

  return (
    <div>
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <Fade>
        <div style={{ marginBottom: isMobile ? 14 : 20 }}>
          <h1 style={{ fontSize: isMobile ? 24 : 32, fontWeight: 700, margin: 0, color: '#1a1a1a', letterSpacing: '-0.01em' }}>
            {currentProject?.name || 'Overview'}
          </h1>
          {currentProject?.description && (
            <p style={{ fontSize: 14, color: '#64748B', margin: '6px 0 0', maxWidth: 720, lineHeight: 1.5 }}>
              {currentProject.description}
            </p>
          )}
        </div>
      </Fade>

      {/* ── TABS ───────────────────────────────────────────────── */}
      <Fade>
        <div style={{
          display: 'flex', gap: 4, marginBottom: isMobile ? 18 : 24,
          borderBottom: '1px solid #E8ECF1',
        }}>
          <TabBtn active={tab === 'stats'} onClick={() => setTab('stats')}>Statistiche</TabBtn>
          <TabBtn active={tab === 'script'} onClick={() => setTab('script')}>Sceneggiatura</TabBtn>
        </div>
      </Fade>

      {tab === 'stats' && (
        <StatsTab
          shots={shots} assets={assets} tasks={tasks}
          profiles={profiles} currentProject={currentProject} isMobile={isMobile}
        />
      )}
      {tab === 'script' && (
        <ScriptTab user={user} currentProject={currentProject} isMobile={isMobile} />
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent', border: 'none',
        padding: '10px 18px', fontSize: 14, fontWeight: 600,
        color: active ? '#F28C28' : '#64748B',
        borderBottom: `2px solid ${active ? '#F28C28' : 'transparent'}`,
        marginBottom: -1, cursor: 'pointer',
        transition: 'color 0.15s ease, border-color 0.15s ease',
      }}
    >
      {children}
    </button>
  )
}

// ──────────────────────────────────────────────────────────────
// STATISTICHE TAB — original Overview content, unchanged in spirit
// ──────────────────────────────────────────────────────────────
function StatsTab({ shots, assets, tasks, profiles, currentProject, isMobile }) {
  // Task-based metrics — every KPI on this page uses the same unit (tasks)
  // so the cards can be compared at a glance.
  const total = tasks.length
  const todo = tasks.filter(t => t.status === 'todo').length
  const wip = tasks.filter(t => t.status === 'wip').length
  const review = tasks.filter(t => t.status === 'review').length
  const done = tasks.filter(t => t.status === 'approved').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  const statusCounts = { todo, wip, review, approved: done }

  const kpis = [
    { label: 'Task in Review', value: review,            color: '#F28C28' },
    { label: 'In corso',       value: wip,               color: '#2563EB' },
    { label: 'Completati',     value: `${done} / ${total}`, color: '#10B981' },
  ]

  const metaBits = [
    { icon: '🎬', label: `${shots.length} shots` },
    { icon: '🧊', label: `${assets.length} assets` },
    { icon: '👥', label: `${profiles.length} ${profiles.length === 1 ? 'persona' : 'persone'}` },
    currentProject?.start_date && { icon: '📅', label: `dal ${formatStart(currentProject.start_date)}` },
  ].filter(Boolean)

  return (
    <div>
      {metaBits.length > 0 && (
        <Fade>
          <div style={{ display: 'flex', gap: isMobile ? 10 : 18, flexWrap: 'wrap', marginBottom: isMobile ? 16 : 22 }}>
            {metaBits.map(m => (
              <span key={m.label} style={{ fontSize: 12, color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, lineHeight: 1 }}>{m.icon}</span>
                {m.label}
              </span>
            ))}
          </div>
        </Fade>
      )}

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

      {/* ── DEPARTMENTS ─────────────────────────────────────────── */}
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

// ──────────────────────────────────────────────────────────────
// SCENEGGIATURA TAB — read-only ScrollReveal for everyone,
// inline editor for producer/admin.
// ──────────────────────────────────────────────────────────────
function ScriptTab({ user, currentProject, isMobile }) {
  // Producer or admin can edit. "Producer" maps to manage_project_settings —
  // it's the permission that already gates project meta editing elsewhere.
  const canEdit = !!currentProject && (isAdmin(user) || hasPermission(user, 'manage_project_settings'))

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(currentProject?.script || '')
  const [saving, setSaving] = useState(false)
  const [script, setScript] = useState(currentProject?.script || '')

  if (!currentProject) {
    return (
      <Card>
        <div style={{ color: '#64748B', fontSize: 14, textAlign: 'center', padding: 20 }}>
          Nessun progetto selezionato.
        </div>
      </Card>
    )
  }

  const handleSave = async () => {
    setSaving(true)
    const { data, error } = await updateProject(currentProject.id, { script: draft })
    setSaving(false)
    if (error) {
      alert('Errore salvataggio: ' + error.message)
      return
    }
    setScript(data?.script ?? draft)
    setEditing(false)
  }

  return (
    <Fade>
      <Card style={{ position: 'relative', paddingTop: isMobile ? 18 : 28 }}>
        {canEdit && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 8,
            marginBottom: 16,
          }}>
            {editing ? (
              <>
                <Btn variant="default" onClick={() => { setDraft(script); setEditing(false) }} disabled={saving}>
                  Annulla
                </Btn>
                <Btn variant="primary" onClick={handleSave} loading={saving}>
                  Salva
                </Btn>
              </>
            ) : (
              <Btn variant="primary" onClick={() => { setDraft(script); setEditing(true) }}>
                ✏️ Modifica testo
              </Btn>
            )}
          </div>
        )}

        {editing ? (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Scrivi qui la sceneggiatura del progetto..."
            style={{
              width: '100%', minHeight: 480, boxSizing: 'border-box',
              padding: '16px 18px', fontSize: 15, lineHeight: 1.6,
              fontFamily: 'inherit', color: '#1a1a1a',
              border: '1px solid #E8ECF1', borderRadius: 12,
              background: '#FAFBFD', outline: 'none', resize: 'vertical',
            }}
          />
        ) : script.trim() ? (
          <div style={{ padding: isMobile ? '4px 4px 12px' : '8px 24px 24px' }}>
            <ScrollReveal
              fontSize={isMobile ? 17 : 22}
              lineHeight={1.7}
            >
              {script}
            </ScrollReveal>
          </div>
        ) : (
          <div style={{
            color: '#94A3B8', fontSize: 14, textAlign: 'center',
            padding: '60px 20px', fontStyle: 'italic',
          }}>
            {canEdit
              ? 'Nessuna sceneggiatura ancora. Clicca "Modifica testo" per iniziare.'
              : 'La sceneggiatura non è ancora stata pubblicata.'}
          </div>
        )}
      </Card>
    </Fade>
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
