import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { DEPTS, SHOT_DEPT_IDS, ASSET_DEPT_IDS, SHOT_STATUSES, isAudioUrl, isVideoUrl, isDeptEnabled, ACCENT } from '../../lib/constants'
import { getWipUpdates } from '../../lib/supabase'
import Av from '../ui/Av'
import EmptyState from '../ui/EmptyState'
import { IconEye } from '../ui/Icons'
import Img from '../ui/Img'
import AnnotatedImage from '../ui/AnnotatedImage'
import ImageLightbox from '../ui/ImageLightbox'

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
  onUpdateTask, onRejectTask, addToast, requestConfirm,
}) {
  // Optimistic dismissal: once the user acts on a task we hide it locally
  // (no waiting for the tasks refetch) so the surrounding list stays put and
  // the scroll position doesn't jump. The underlying tasks state will catch
  // up shortly via the realtime subscription.
  const [dismissedIds, setDismissedIds] = useState(() => new Set())
  const dismissTask = useCallback((id) => {
    setDismissedIds(prev => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const reviewTasks = useMemo(
    () => tasks
      .filter(t => t.status === 'review' && !dismissedIds.has(t.id))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)),
    [tasks, dismissedIds],
  )

  // Clean up dismissedIds for tasks that have actually left review status
  // (otherwise the Set grows forever and re-reviewed tasks would stay hidden).
  useEffect(() => {
    setDismissedIds(prev => {
      if (prev.size === 0) return prev
      const stillInReview = new Set(tasks.filter(t => t.status === 'review').map(t => t.id))
      let changed = false
      const next = new Set()
      for (const id of prev) {
        if (stillInReview.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [tasks])

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

  // ── Project progress (task-based, mirrors OverviewPage) ──
  const progress = useMemo(() => {
    const total = tasks.length
    const todo = tasks.filter(t => t.status === 'todo').length
    const wip = tasks.filter(t => t.status === 'wip').length
    const review = tasks.filter(t => t.status === 'review').length
    const done = tasks.filter(t => t.status === 'approved').length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    const byId = { not_started: todo, in_progress: wip + review, approved: done }
    const statusCounts = SHOT_STATUSES.map(st => ({ ...st, count: byId[st.id] || 0 }))
    return { total, done, pct, statusCounts }
  }, [tasks])

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
                onDismiss={dismissTask}
                user={user}
                addToast={addToast}
                requestConfirm={requestConfirm}
              />
            ))}
          </div>
        )}
      </div>

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
function TaskReviewCard({ index, total, task, wips, onUpdateTask, onRejectTask, onDismiss, user, addToast, requestConfirm }) {
  const dept = DEPTS.find(d => d.id === task.department)
  const assignees = task.assignees || []
  const [actionLoading, setActionLoading] = useState(null)
  const [showRejectBox, setShowRejectBox] = useState(false)
  const [rejectComment, setRejectComment] = useState('')

  // Every WIP with content, newest first. Staff want to scroll back through
  // the student's earlier deliveries on this task — not just the latest one.
  const wipsByUser = useMemo(() => {
    return wips.filter(w => (w.images && w.images.length > 0) || w.note)
  }, [wips])

  const handleApprove = async () => {
    setActionLoading('approve')
    // Optimistic dismissal — the card vanishes from the page immediately so the
    // staff can keep working through the queue without losing scroll position.
    onDismiss?.(task.id)
    try { await onUpdateTask(task.id, { status: 'approved' }) } catch (e) { console.error(e) }
    setActionLoading(null)
    addToast?.('Task approvato', 'success')
  }

  const handleRejectClick = () => {
    if (!showRejectBox) { setShowRejectBox(true); return }
    const comment = rejectComment.trim()
    setActionLoading('reject')
    setShowRejectBox(false)
    onDismiss?.(task.id)
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
          <WipCarousel wips={wipsByUser} user={user} addToast={addToast} />
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
          >{actionLoading === 'approve' ? '...' : '✓ Approve'}</button>

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
          >{actionLoading === 'reject' ? '...' : (showRejectBox ? 'Submit' : '↩ Back to Wip')}</button>

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

// Horizontal swipeable carousel: shows one WIP at a time so a task with 10
// updates doesn't turn the review feed into an endless scroll. Each slide
// snap-aligns to the container; arrow buttons + dot indicator make discovery
// of older WIPs obvious.
function WipCarousel({ wips, user, addToast }) {
  const scrollerRef = useRef(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const scrollTo = useCallback((idx) => {
    const el = scrollerRef.current
    if (!el) return
    const clamped = Math.max(0, Math.min(wips.length - 1, idx))
    const slide = el.children[clamped]
    if (slide) slide.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })
  }, [wips.length])

  // Track which slide is currently snapped into view via scroll position.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth
        if (!w) return
        const idx = Math.round(el.scrollLeft / w)
        setActiveIdx(idx)
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  const single = wips.length === 1

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={scrollerRef}
        style={{
          display: 'flex', gap: 16, overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
          paddingBottom: single ? 0 : 4,
        }}
      >
        {wips.map(w => (
          <div key={w.id} style={{
            flex: '0 0 100%', minWidth: 0,
            scrollSnapAlign: 'start',
          }}>
            <WipBlock wip={w} user={user} addToast={addToast} />
          </div>
        ))}
      </div>

      {!single && (
        <>
          {activeIdx > 0 && (
            <button
              onClick={() => scrollTo(activeIdx - 1)}
              aria-label="WIP precedente"
              style={carouselArrowStyle('left')}
            >‹</button>
          )}
          {activeIdx < wips.length - 1 && (
            <button
              onClick={() => scrollTo(activeIdx + 1)}
              aria-label="WIP successivo"
              style={carouselArrowStyle('right')}
            >›</button>
          )}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 6,
            marginTop: 10,
          }}>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginRight: 8 }}>
              WIP {activeIdx + 1} / {wips.length}
            </span>
            {wips.map((_, i) => (
              <button
                key={i}
                onClick={() => scrollTo(i)}
                aria-label={`Vai al WIP ${i + 1}`}
                style={{
                  width: 8, height: 8, borderRadius: '50%', padding: 0,
                  background: i === activeIdx ? '#F28C28' : '#CBD5E1',
                  border: 'none', cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Hide the native scrollbar on Chromium-based browsers */}
      <style>{`
        div[data-scroller="wip-carousel"]::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}

function carouselArrowStyle(side) {
  return {
    position: 'absolute', top: '50%',
    [side]: -14, transform: 'translateY(-50%)',
    width: 36, height: 36, borderRadius: '50%',
    background: '#fff', color: '#1a1a1a',
    border: '1px solid #E2E8F0',
    boxShadow: '0 4px 14px rgba(15,23,42,0.12)',
    fontSize: 22, fontWeight: 600, lineHeight: 1,
    cursor: 'pointer', zIndex: 2,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
}

function WipBlock({ wip, user, addToast }) {
  const author = wip.author || {}
  const images = (wip.images || []).filter(u => !isAudioUrl(u) && !isVideoUrl(u))
  const audios = (wip.images || []).filter(isAudioUrl)
  const videos = (wip.images || []).filter(isVideoUrl)
  const date = wip.created_at ? new Date(wip.created_at) : null
  const [lightboxUrl, setLightboxUrl] = useState(null)

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
              <AnnotatedImage
                key={i}
                src={src} alt=""
                onClick={() => setLightboxUrl(src)}
                style={{
                  width: '100%', height: images.length === 1 ? 480 : 320,
                  borderRadius: 12, background: '#000',
                  border: '1px solid #E8ECF1', objectFit: 'contain', cursor: 'zoom-in',
                }}
              />
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
      <ImageLightbox src={lightboxUrl} images={images} onClose={() => setLightboxUrl(null)} user={user} addToast={addToast} />
    </div>
  )
}
