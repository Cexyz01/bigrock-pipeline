import { useRef, useState } from 'react'
import { DEPTS, TASK_STATUSES, hasPermission, isAdmin } from '../../lib/constants'
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
              const deptTasks = tasks.filter(tk => tk.department === dept.id)
              const deptDone = deptTasks.filter(tk => tk.status === 'approved').length
              const total = deptTasks.length
              const pct = total > 0 ? Math.round((deptDone / total) * 100) : 0

              return (
                <div key={dept.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#1a1a1a' }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: dept.color, display: 'inline-block' }} />
                      {dept.label}
                    </span>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                      {deptDone}/{total} tasks
                    </span>
                  </div>
                  <Bar value={pct} h={5} />
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
// .docx upload for producer/admin (text extracted client-side via mammoth).
// ──────────────────────────────────────────────────────────────
function ScriptTab({ user, currentProject, isMobile }) {
  // Producer or admin can edit. "Producer" maps to manage_project_settings —
  // it's the permission that already gates project meta editing elsewhere.
  const canEdit = !!currentProject && (isAdmin(user) || hasPermission(user, 'manage_project_settings'))

  const fileRef = useRef(null)
  const [script, setScript] = useState(currentProject?.script || '')
  const [filename, setFilename] = useState(currentProject?.script_filename || '')
  const [updatedAt, setUpdatedAt] = useState(currentProject?.updated_at || null)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState('')

  if (!currentProject) {
    return (
      <Card>
        <div style={{ color: '#64748B', fontSize: 14, textAlign: 'center', padding: 20 }}>
          Nessun progetto selezionato.
        </div>
      </Card>
    )
  }

  const handleFile = async (file) => {
    if (!file) return
    setErr('')
    const lower = file.name.toLowerCase()
    const isDocx = lower.endsWith('.docx')
    const isPdf = lower.endsWith('.pdf')
    // Screenwriting tools often save plain text under their own extension
    // (.fountain, .script, .fdx-as-text). Treat any non-binary script as text.
    const isText = /\.(txt|script|fountain|md|rtf|fdx)$/.test(lower)
    if (!isDocx && !isPdf && !isText) {
      setErr('Formato non supportato. Usa .docx, .pdf, .txt, .script o .fountain.')
      return
    }
    setUploading(true)
    try {
      // Dynamic imports keep mammoth/pdfjs out of the main bundle —
      // only producers/admins who actually upload pay the cost.
      let text
      if (isDocx) {
        text = await extractDocx(await file.arrayBuffer())
      } else if (isPdf) {
        text = await extractPdf(await file.arrayBuffer())
      } else {
        text = (await file.text()).trim()
      }
      if (!text) {
        setErr('Il documento sembra vuoto.')
        return
      }
      const { data, error } = await updateProject(currentProject.id, {
        script: text,
        script_filename: file.name,
      })
      if (error) {
        setErr('Errore salvataggio: ' + error.message)
        return
      }
      setScript(data?.script ?? text)
      setFilename(data?.script_filename ?? file.name)
      setUpdatedAt(data?.updated_at ?? new Date().toISOString())
    } catch (e) {
      console.error('[script upload] failed', e)
      setErr('Impossibile leggere il documento: ' + (e?.message || 'errore sconosciuto'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Fade>
      <Card style={{ position: 'relative', paddingTop: isMobile ? 18 : 28 }}>
        {canEdit && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 12, marginBottom: 18, flexWrap: 'wrap',
          }}>
            <div style={{ fontSize: 13, color: '#64748B', minWidth: 0 }}>
              {filename ? (
                <span>
                  <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{filename}</span>
                  {updatedAt && <span> · aggiornata il {formatDateTime(updatedAt)}</span>}
                </span>
              ) : (
                <span style={{ fontStyle: 'italic' }}>Nessun documento caricato</span>
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,.pdf,.txt,.script,.fountain,.md,.rtf,.fdx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,text/plain"
                onChange={e => handleFile(e.target.files?.[0])}
                style={{ display: 'none' }}
              />
              <Btn variant="primary" onClick={() => fileRef.current?.click()} loading={uploading}>
                📄 {filename ? 'Carica nuova versione' : 'Carica sceneggiatura'}
              </Btn>
            </div>
          </div>
        )}

        {err && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C',
            padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 14,
          }}>
            {err}
          </div>
        )}

        {script.trim() ? (
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
              ? 'Nessuna sceneggiatura ancora. Carica un file (.docx, .pdf, .txt, .script, .fountain) per iniziare.'
              : 'La sceneggiatura non è ancora stata pubblicata.'}
          </div>
        )}
      </Card>
    </Fade>
  )
}

async function extractDocx(arrayBuffer) {
  const { default: mammoth } = await import('mammoth')
  const { value } = await mammoth.extractRawText({ arrayBuffer })
  return (value || '').trim()
}

// pdf.js needs its worker registered once before getDocument(). Using Vite's
// `?worker` suffix lets Vite emit a proper module Worker — more reliable than
// passing a URL string, which can break on MIME-type mismatches in production.
let pdfjsLibPromise = null
async function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const pdfjs = await import('pdfjs-dist')
      const { default: PdfWorker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?worker')
      pdfjs.GlobalWorkerOptions.workerPort = new PdfWorker()
      return pdfjs
    })()
  }
  return pdfjsLibPromise
}

async function extractPdf(arrayBuffer) {
  const pdfjs = await getPdfjs()
  // Clone the buffer — pdfjs may detach it, breaking any retry attempts.
  const data = arrayBuffer.slice(0)
  const pdf = await pdfjs.getDocument({ data, isEvalSupported: false }).promise
  const paragraphs = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // Group items by their Y position so original line breaks survive.
    const lines = []
    let lastY = null
    let buf = []
    for (const item of content.items) {
      const y = item.transform?.[5]
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        if (buf.length) lines.push(buf.join('').trim())
        buf = []
      }
      buf.push(item.str)
      lastY = y
    }
    if (buf.length) lines.push(buf.join('').trim())
    paragraphs.push(lines.filter(Boolean).join('\n'))
  }
  return paragraphs.join('\n\n').trim()
}

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleDateString('it', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

// Italian-locale short date for the meta strip — "dal 12 mar 2026"
function formatStart(iso) {
  try {
    return new Date(iso).toLocaleDateString('it', { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}
