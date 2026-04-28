import { useState, useEffect, useMemo, useRef } from 'react'
import { DEPTS, SHOT_DEPT_IDS, ASSET_DEPT_IDS, SHOT_STATUSES, isAudioUrl, isVideoUrl, isDeptEnabled, ACCENT } from '../../lib/constants'
import { getWipUpdates } from '../../lib/supabase'
import Av from '../ui/Av'
import EmptyState from '../ui/EmptyState'
import { IconEye } from '../ui/Icons'

// ── date helpers (local-time, no UTC drift) ──
const MS_DAY = 86400000
const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const daysBetween = (a, b) => Math.round((b.getTime() - a.getTime()) / MS_DAY)
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const MONTHS_IT = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const DAYS_IT = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
const formatLongDate = (d) => `${DAYS_IT[d.getDay()]} ${d.getDate()} ${MONTHS_IT[d.getMonth()]} ${d.getFullYear()}`

// Lighten/darken a hex by percent
function shade(hex, percent) {
  if (!hex || !hex.startsWith('#')) return hex
  let h = hex.slice(1); if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16)
  let r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (percent / 100) * 255)))
  return '#' + [f(r), f(g), f(b)].map(x => x.toString(16).padStart(2, '0')).join('')
}

export default function ReviewPage({
  shots = [], assets = [], tasks = [], profiles = [], user, currentProject,
  ganttItems = [], ganttLanes = [],
  onUpdateTask, onRejectTask, addToast, requestConfirm,
}) {
  const reviewTasks = useMemo(
    () => tasks
      .filter(t => t.status === 'review')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [tasks],
  )

  // Load WIP updates per task
  const [wipsByTask, setWipsByTask] = useState({})
  useEffect(() => {
    let cancelled = false
    Promise.all(reviewTasks.map(async t => {
      if (wipsByTask[t.id]) return null
      const w = await getWipUpdates(t.id)
      return [t.id, w]
    })).then(results => {
      if (cancelled) return
      const additions = {}
      for (const r of results) { if (r) additions[r[0]] = r[1] }
      if (Object.keys(additions).length) setWipsByTask(prev => ({ ...prev, ...additions }))
    })
    return () => { cancelled = true }
  }, [reviewTasks.map(t => t.id).join(',')])

  // ── Project progress (mirrors OverviewPage) ──
  const progress = useMemo(() => {
    const isDone = st => st === 'approved' || st === 'review'
    let total = 0, done = 0
    for (const sh of shots) for (const id of SHOT_DEPT_IDS) {
      if (!isDeptEnabled(sh, id)) continue
      total++; if (isDone(sh[`status_${id}`])) done++
    }
    for (const a of assets) for (const id of ASSET_DEPT_IDS) {
      if (!isDeptEnabled(a, id)) continue
      total++; if (isDone(a[`status_${id}`])) done++
    }
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    const statusCounts = SHOT_STATUSES.map(st => {
      let c = 0
      for (const sh of shots) for (const id of SHOT_DEPT_IDS) {
        if (isDeptEnabled(sh, id) && sh[`status_${id}`] === st.id) c++
      }
      for (const a of assets) for (const id of ASSET_DEPT_IDS) {
        if (isDeptEnabled(a, id) && a[`status_${id}`] === st.id) c++
      }
      return { ...st, count: c }
    })
    return { total, done, pct, statusCounts }
  }, [shots, assets])

  return (
    <div style={{ background: '#1a1a1a', height: '100%', overflowY: 'auto' }}>
      <Hero project={currentProject} progress={progress} reviewCount={reviewTasks.length} />

      {/* Tasks */}
      <div style={{ background: '#F0F2F5', paddingTop: 40 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px 40px' }}>
        {reviewTasks.length === 0 ? (
          <div style={{ background: '#fff', borderRadius: 24, padding: 60, border: '1px solid #E8ECF1' }}>
            <EmptyState icon={<IconEye size={56} color="#94A3B8" />} title="Nessun task in review" sub="Quando uno staff invia un task per review apparirà qui." />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {reviewTasks.map((task, idx) => (
              <TaskReviewCard
                key={task.id}
                index={idx + 1}
                total={reviewTasks.length}
                task={task}
                wips={wipsByTask[task.id] || []}
                onUpdateTask={onUpdateTask}
                onRejectTask={onRejectTask}
                addToast={addToast}
                requestConfirm={requestConfirm}
              />
            ))}
          </div>
        )}
      </div>

      {/* Mini Gantt section */}
      {(ganttItems.length > 0 || (currentProject?.start_date && currentProject?.end_date)) && (
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 32px 60px' }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Andamento Progetto</h2>
          </div>
          <MiniGantt items={ganttItems} lanes={ganttLanes} project={currentProject} />
        </div>
      )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// HERO
// ────────────────────────────────────────────────────────────
function Hero({ project, progress, reviewCount }) {
  const today = new Date()
  return (
    <div style={{
      position: 'relative',
      background: `linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)`,
      color: '#fff', padding: '60px 32px 80px',
      overflow: 'hidden',
    }}>
      {/* Decorative orange glow */}
      <div style={{
        position: 'absolute', top: -200, right: -200, width: 500, height: 500,
        background: `radial-gradient(circle, ${ACCENT}40 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
          <span style={{
            display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
            background: '#22C55E', boxShadow: '0 0 0 0 #22C55E80',
            animation: 'pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
            Live · {formatLongDate(today)}
          </span>
        </div>
        <h1 style={{
          fontSize: 'clamp(56px, 9vw, 96px)', fontWeight: 900, margin: '0 0 16px',
          lineHeight: 0.95, letterSpacing: '-0.02em',
          background: `linear-gradient(135deg, #fff 0%, ${ACCENT} 100%)`,
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>REVIEW</h1>

        {project && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{project.name}</div>
            {project.description && (
              <div style={{ fontSize: 14, color: '#94A3B8', maxWidth: 720, lineHeight: 1.5 }}>{project.description}</div>
            )}
          </div>
        )}

        {/* Stats grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16,
          marginTop: 24,
        }}>
          <Stat label="Task in Review" value={reviewCount} accent={ACCENT} />
          <Stat label="Progresso" value={`${progress.pct}%`} accent="#22C55E" />
          <Stat label="Completati" value={`${progress.done} / ${progress.total}`} accent="#3B82F6" />
        </div>

        {/* Progress bar */}
        <div style={{ marginTop: 32 }}>
          <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progress.pct}%`,
              background: `linear-gradient(90deg, ${ACCENT} 0%, #22C55E 100%)`,
              transition: 'width 0.6s ease',
            }} />
          </div>
          <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
            {progress.statusCounts.map(st => (
              <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: st.color, opacity: 0.9 }} />
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{st.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{st.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.7); }
        70% { box-shadow: 0 0 0 10px rgba(34,197,94,0); }
        100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
      }`}</style>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16, padding: '18px 22px',
      borderLeft: `3px solid ${accent}`,
    }}>
      <div style={{ fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// TASK REVIEW CARD
// ────────────────────────────────────────────────────────────
function TaskReviewCard({ index, total, task, wips, onUpdateTask, onRejectTask, addToast, requestConfirm }) {
  const dept = DEPTS.find(d => d.id === task.department)
  const assignees = task.assignees || []
  const [actionLoading, setActionLoading] = useState(null)
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [rejectComment, setRejectComment] = useState('')

  // Group WIPs by user_id, take latest with content per user
  const wipsByUser = useMemo(() => {
    const map = new Map()
    for (const w of wips) {
      const hasContent = (w.images && w.images.length > 0) || w.note
      if (!hasContent) continue
      if (!map.has(w.user_id)) map.set(w.user_id, w)
    }
    return Array.from(map.values())
  }, [wips])

  const handleApprove = async () => {
    setActionLoading('approve')
    try { await onUpdateTask(task.id, { status: 'approved' }) } catch (e) { console.error(e) }
    setActionLoading(null)
    addToast?.('Task approvato', 'success')
  }

  const handleRejectClick = () => {
    if (!showRejectBox) { setShowRejectBox(true); return }
    const comment = rejectComment.trim()
    setActionLoading('reject')
    setShowRejectBox(false)
    onRejectTask(task.id, comment)
      .catch(e => console.error(e))
      .finally(() => {
        setActionLoading(null)
        setRejectComment('')
        addToast?.('Modifiche richieste', 'success')
      })
  }

  return (
    <div style={{
      background: '#fff', borderRadius: 24, overflow: 'hidden',
      border: '1px solid #E8ECF1', boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
    }}>
      {/* Top stripe */}
      <div style={{ height: 6, background: dept?.color || '#94A3B8' }} />

      <div style={{ padding: '28px 32px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 700, letterSpacing: '0.06em' }}>
                {String(index).padStart(2, '0')} / {String(total).padStart(2, '0')}
              </span>
              {dept && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                  background: `${dept.color}18`, color: dept.color, border: `1px solid ${dept.color}40`,
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                }}>{dept.label}</span>
              )}
              {task.shot && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>{task.shot.code}</span>
              )}
              {task.asset && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: 'rgba(167,139,250,0.12)', color: '#7C3AED', border: '1px solid rgba(167,139,250,0.4)' }}>{task.asset.name}</span>
              )}
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a1a', margin: '0 0 8px', lineHeight: 1.15 }}>
              {task.review_title || task.title}
            </h2>
            {(task.review_description || task.description) && (
              <p style={{ fontSize: 15, color: '#64748B', lineHeight: 1.55, margin: 0, maxWidth: 820 }}>
                {task.review_description || task.description}
              </p>
            )}
          </div>
          {assignees.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ display: 'flex' }}>
                {assignees.slice(0, 5).map((a, i) => (
                  <div key={a.user.id} style={{
                    marginLeft: i === 0 ? 0 : -10, border: '2px solid #fff', borderRadius: '50%',
                    display: 'flex', boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }}>
                    <Av name={a.user.full_name} size={32} url={a.user.avatar_url} />
                  </div>
                ))}
              </div>
              {assignees.length > 5 && (
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>+{assignees.length - 5}</span>
              )}
            </div>
          )}
        </div>

        {/* WIPs by student */}
        {wipsByUser.length === 0 ? (
          <div style={{
            padding: 28, borderRadius: 16, background: '#F8FAFC', border: '1px dashed #CBD5E1',
            textAlign: 'center', fontSize: 13, color: '#94A3B8',
          }}>
            Nessun WIP disponibile
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {wipsByUser.map(w => <WipBlock key={w.id} wip={w} />)}
          </div>
        )}

        {/* Action bar */}
        <div style={{
          marginTop: 26, paddingTop: 22, borderTop: '1px solid #F1F5F9',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <button
            onClick={handleApprove}
            disabled={actionLoading !== null}
            style={{
              padding: '12px 28px', fontSize: 14, fontWeight: 700, borderRadius: 12,
              background: '#22C55E', color: '#fff', border: 'none',
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              opacity: actionLoading === 'approve' ? 0.5 : 1,
              boxShadow: '0 4px 12px rgba(34,197,94,0.3)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { if (!actionLoading) e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >{actionLoading === 'approve' ? '...' : '✓ Approva'}</button>

          <button
            onClick={handleRejectClick}
            disabled={actionLoading !== null}
            style={{
              padding: '12px 24px', fontSize: 14, fontWeight: 700, borderRadius: 12,
              background: showRejectBox ? '#F59E0B' : '#fff',
              color: showRejectBox ? '#fff' : '#F59E0B',
              border: `1.5px solid ${showRejectBox ? '#F59E0B' : '#FCD34D'}`,
              cursor: actionLoading ? 'not-allowed' : 'pointer',
              opacity: actionLoading === 'reject' ? 0.5 : 1,
              transition: 'all 0.15s ease',
            }}
          >{actionLoading === 'reject' ? '...' : (showRejectBox ? 'Invia richiesta modifiche' : '↩ Richiedi modifiche')}</button>

          {showRejectBox && (
            <button
              onClick={() => { setShowRejectBox(false); setRejectComment('') }}
              style={{
                padding: '12px 18px', fontSize: 13, fontWeight: 600, borderRadius: 12,
                background: 'transparent', color: '#94A3B8', border: 'none', cursor: 'pointer',
              }}
            >Annulla</button>
          )}
        </div>

        {showRejectBox && (
          <textarea
            autoFocus
            value={rejectComment}
            onChange={e => setRejectComment(e.target.value)}
            placeholder="Commento per gli studenti (opzionale)..."
            rows={3}
            style={{
              width: '100%', marginTop: 14, padding: '12px 14px', fontSize: 14,
              border: '1.5px solid #FCD34D', borderRadius: 12, outline: 'none',
              background: '#FFFBEB', color: '#1a1a1a', resize: 'vertical',
              fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box',
            }}
          />
        )}
      </div>
    </div>
  )
}

function WipBlock({ wip }) {
  const author = wip.author || {}
  const images = (wip.images || []).filter(u => !isAudioUrl(u) && !isVideoUrl(u))
  const audios = (wip.images || []).filter(isAudioUrl)
  const videos = (wip.images || []).filter(isVideoUrl)
  const date = wip.created_at ? new Date(wip.created_at) : null

  return (
    <div style={{
      background: '#FAFBFD', borderRadius: 16, border: '1px solid #E8ECF1',
      overflow: 'hidden',
    }}>
      {/* Author bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        borderBottom: '1px solid #E8ECF1', background: '#fff',
      }}>
        <Av name={author.full_name || '?'} size={28} url={author.avatar_url} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{author.full_name || 'Sconosciuto'}</div>
          {date && (
            <div style={{ fontSize: 11, color: '#94A3B8' }}>
              {date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
              {date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {wip.note && (
          <div style={{
            fontSize: 14, color: '#1a1a1a', lineHeight: 1.55, marginBottom: images.length || audios.length || videos.length ? 14 : 0,
            padding: '10px 14px', background: '#fff', borderRadius: 10, border: '1px solid #E8ECF1',
          }}>{wip.note}</div>
        )}

        {images.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: images.length === 1 ? '1fr' : `repeat(${Math.min(images.length, 3)}, 1fr)`,
            gap: 10,
          }}>
            {images.map((src, i) => (
              <a key={i} href={src} target="_blank" rel="noopener noreferrer" style={{ display: 'block', borderRadius: 12, overflow: 'hidden', background: '#000', border: '1px solid #E8ECF1' }}>
                <img src={src} alt="" style={{
                  width: '100%', maxHeight: images.length === 1 ? 480 : 320, objectFit: 'contain',
                  display: 'block', background: '#000',
                }} />
              </a>
            ))}
          </div>
        )}

        {videos.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: images.length ? 10 : 0 }}>
            {videos.map((src, i) => (
              <video key={i} src={src} controls style={{ width: '100%', maxHeight: 480, borderRadius: 12, background: '#000' }} />
            ))}
          </div>
        )}

        {audios.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: (images.length || videos.length) ? 10 : 0 }}>
            {audios.map((src, i) => (
              <audio key={i} src={src} controls style={{ width: '100%' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// MINI GANTT
// ────────────────────────────────────────────────────────────
function MiniGantt({ items, lanes: laneRecords, project }) {
  const containerRef = useRef(null)
  const [containerW, setContainerW] = useState(1000)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const update = () => setContainerW(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }, [])

  const { rangeStart, rangeDays } = useMemo(() => {
    if (project?.start_date && project?.end_date) {
      const s = parseISO(project.start_date), e = parseISO(project.end_date)
      return { rangeStart: s, rangeDays: Math.max(1, daysBetween(s, e) + 1) }
    }
    let min = addDays(today, -14), max = addDays(today, 56)
    for (const it of items) {
      const s = parseISO(it.start_date), e = parseISO(it.end_date)
      if (s < min) min = s; if (e > max) max = e
    }
    const dow = (min.getDay() + 6) % 7
    return { rangeStart: addDays(min, -dow - 7), rangeDays: daysBetween(addDays(min, -dow - 7), addDays(max, 14)) + 1 }
  }, [project?.start_date, project?.end_date, items, today])

  const dayW = Math.max(2, (containerW - 200) / rangeDays)
  const todayX = daysBetween(rangeStart, today) * dayW

  // Group by lane (declared first, then orphans)
  const lanes = useMemo(() => {
    const map = new Map()
    for (const l of laneRecords) map.set(l.name, [])
    for (const it of items) {
      const key = it.lane || 'Senza lane'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(it)
    }
    for (const arr of map.values()) arr.sort((a, b) => a.start_date.localeCompare(b.start_date))
    return Array.from(map.entries()).filter(([, arr]) => arr.length > 0)
  }, [laneRecords, items])

  // Months strip
  const months = useMemo(() => {
    const arr = []
    let cur = null
    for (let i = 0; i < rangeDays; i++) {
      const d = addDays(rangeStart, i)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      if (!cur || cur.key !== key) {
        cur = { key, label: d.toLocaleDateString('it-IT', { month: 'short', year: 'numeric' }), x: i * dayW, w: dayW }
        arr.push(cur)
      } else cur.w += dayW
    }
    return arr
  }, [rangeStart, rangeDays, dayW])

  const ROW_H = 36, LANE_W = 200, HEAD = 32

  return (
    <div ref={containerRef} style={{
      background: '#fff', borderRadius: 20, overflow: 'hidden',
      border: '1px solid #E8ECF1', boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
    }}>
      <div style={{ position: 'relative', height: HEAD + Math.max(lanes.length, 1) * ROW_H }}>
        {/* Months row */}
        <div style={{ position: 'absolute', top: 0, left: LANE_W, right: 0, height: HEAD, borderBottom: '1px solid #E8ECF1', background: '#FAFBFD' }}>
          {months.map(m => (
            <div key={m.key} style={{
              position: 'absolute', left: m.x, width: m.w, top: 0, bottom: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'flex-start', paddingLeft: 8,
              fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em',
              borderRight: '1px solid #F1F5F9',
            }}>{m.label}</div>
          ))}
        </div>

        {/* Lane rows */}
        {lanes.map(([name, arr], li) => {
          const rangeEnd = addDays(rangeStart, rangeDays - 1)
          return (
          <div key={name} style={{
            position: 'absolute', top: HEAD + li * ROW_H, left: 0, right: 0, height: ROW_H,
            background: li % 2 === 0 ? '#FAFBFD' : '#fff',
            borderBottom: '1px solid #F1F5F9',
            overflow: 'hidden',
          }}>
            {/* Bars area — confined to the timeline (after the lane label column) */}
            <div style={{ position: 'absolute', left: LANE_W, top: 0, right: 0, height: '100%' }}>
              {arr.map(it => {
                const s = parseISO(it.start_date), e = parseISO(it.end_date)
                // Clamp to visible range so out-of-range items truncate cleanly instead of bleeding
                const sClamped = s < rangeStart ? rangeStart : s
                const eClamped = e > rangeEnd ? rangeEnd : e
                if (eClamped < sClamped) return null
                const truncLeft = s < rangeStart
                const truncRight = e > rangeEnd
                const x = daysBetween(rangeStart, sClamped) * dayW + 2
                const w = Math.max(4, (daysBetween(sClamped, eClamped) + 1) * dayW - 4)
                return (
                  <div key={it.id} title={`${it.title}  ·  ${it.start_date} → ${it.end_date}`}
                    style={{
                      position: 'absolute', left: x, top: 6, height: ROW_H - 12, width: w,
                      background: `linear-gradient(135deg, ${it.color} 0%, ${shade(it.color, -10)} 100%)`,
                      borderRadius: truncLeft && truncRight ? 0 : (truncLeft ? '0 6px 6px 0' : truncRight ? '6px 0 0 6px' : 6),
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                      color: '#fff', fontSize: 11, fontWeight: 600,
                      display: 'flex', alignItems: 'center', padding: '0 8px',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>{it.title}</div>
                )
              })}
            </div>
            {/* Lane label sits on top so out-of-range bars can't bleed under it */}
            <div style={{
              position: 'absolute', left: 0, top: 0, bottom: 0, width: LANE_W, zIndex: 1,
              display: 'flex', alignItems: 'center', padding: '0 16px',
              fontSize: 12, fontWeight: 600, color: '#1a1a1a',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              borderRight: '1px solid #E2E8F0', background: li % 2 === 0 ? '#FAFBFD' : '#fff',
            }}>{name}</div>
          </div>
        )})}

        {/* Today line */}
        {todayX >= 0 && todayX <= rangeDays * dayW && (
          <>
            <div style={{
              position: 'absolute', top: 0, left: LANE_W + todayX, width: 2,
              height: HEAD + lanes.length * ROW_H,
              background: ACCENT, opacity: 0.85, zIndex: 2, pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', top: 4, left: LANE_W + todayX - 24, width: 48,
              padding: '2px 0', borderRadius: 4, background: ACCENT, color: '#fff',
              fontSize: 10, fontWeight: 700, textAlign: 'center', zIndex: 3, pointerEvents: 'none',
            }}>OGGI</div>
          </>
        )}
      </div>
    </div>
  )
}
