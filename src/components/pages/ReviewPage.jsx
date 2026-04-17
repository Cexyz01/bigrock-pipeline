import { useState, useEffect, useRef, useCallback } from 'react'
import { DEPTS, isAudioUrl, isVideoUrl, ACCENT } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import { getWipUpdates, updateSlideLayout, updateReviewMeta } from '../../lib/supabase'
import Av from '../ui/Av'
import EmptyState from '../ui/EmptyState'
import { IconEye, IconX } from '../ui/Icons'

const CW = 960, CH = 540

function defaultLayout(task, media) {
  const els = []
  if (task) {
    const dept = DEPTS.find(d => d.id === task.department)
    if (dept) els.push({ id: 'badge', type: 'badge', x: 30, y: 20, w: 120, h: 28 })
    if (task.assigned_to) els.push({ id: 'student', type: 'student', x: CW - 250, y: 20, w: 220, h: 28 })
    els.push({ id: 'title', type: 'title', x: 30, y: 70, w: CW - 60, h: 50, fontSize: 28 })
    els.push({ id: 'desc', type: 'description', x: 30, y: 130, w: CW - 60, h: 60, fontSize: 14 })
  }
  const images = (media || []).filter(m => !isAudioUrl(m))
  const audios = (media || []).filter(m => isAudioUrl(m))
  if (images.length === 1) {
    els.push({ id: 'img_0', type: 'image', src: images[0], x: 80, y: 200, w: 800, h: 310 })
  } else if (images.length === 2) {
    els.push({ id: 'img_0', type: 'image', src: images[0], x: 30, y: 200, w: 440, h: 310 })
    els.push({ id: 'img_1', type: 'image', src: images[1], x: 490, y: 200, w: 440, h: 310 })
  } else if (images.length >= 3) {
    const cols = Math.min(images.length, 4)
    const gw = (CW - 60 - (cols - 1) * 10) / cols
    images.slice(0, 4).forEach((img, i) => {
      els.push({ id: `img_${i}`, type: 'image', src: img, x: 30 + i * (gw + 10), y: 200, w: gw, h: 310 })
    })
  }
  audios.forEach((a, i) => {
    els.push({ id: `audio_${i}`, type: 'audio', src: a, x: 30, y: 200 + i * 50, w: 350, h: 40 })
  })
  return { elements: els, bg: '#FFFFFF' }
}

// Custom slides stored in localStorage
function loadCustomSlides() {
  try { return JSON.parse(localStorage.getItem('review_custom_slides') || '[]') } catch { return [] }
}
function saveCustomSlides(slides) { localStorage.setItem('review_custom_slides', JSON.stringify(slides)) }

export default function ReviewPage({ shots, tasks, profiles, user, onUpdateTask, onRejectTask, onUpdateReviewMeta, addToast, requestConfirm }) {
  const reviewTasks = tasks.filter(t => t.status === 'review')
  const [wipCache, setWipCache] = useState({})
  const [selectedSlide, setSelectedSlide] = useState(0)
  const [selectedEl, setSelectedEl] = useState(null)
  const [activeTool, setActiveTool] = useState(null) // null = pointer, 'arrow' = draw arrow
  const [presenting, setPresenting] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [layouts, setLayouts] = useState({})
  const [customSlides, setCustomSlides] = useState(loadCustomSlides)
  const [dragSlideIdx, setDragSlideIdx] = useState(null)
  const [dragOverSlideIdx, setDragOverSlideIdx] = useState(null)
  const [skippedSlides, setSkippedSlides] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('review_skipped') || '[]')) } catch { return new Set() }
  })
  const canvasRef = useRef(null)
  const saveTimer = useRef(null)

  // Unified slide list: mix of task-slides and custom slides
  const [order, setOrder] = useState(() => {
    try { return JSON.parse(localStorage.getItem('review_order') || '[]') } catch { return [] }
  })

  // Build allSlides from order
  const allSlides = (() => {
    const taskMap = {}; reviewTasks.forEach(t => { taskMap[t.id] = { type: 'task', task: t, id: t.id } })
    const customMap = {}; customSlides.forEach(c => { customMap[c.id] = { type: 'custom', id: c.id, title: c.title } })
    const result = []
    order.forEach(id => {
      if (taskMap[id]) { result.push(taskMap[id]); delete taskMap[id] }
      else if (customMap[id]) { result.push(customMap[id]); delete customMap[id] }
    })
    Object.values(taskMap).forEach(s => result.push(s))
    Object.values(customMap).forEach(s => result.push(s))
    return result
  })()

  useEffect(() => {
    localStorage.setItem('review_order', JSON.stringify(allSlides.map(s => s.id)))
  }, [allSlides.length, order])

  // Load WIP
  useEffect(() => {
    reviewTasks.forEach(t => {
      if (!wipCache[t.id]) {
        getWipUpdates(t.id).then(updates => {
          const all = []; updates.forEach(u => { if (u.images?.length) all.push(...u.images) })
          if (all.length > 0) setWipCache(prev => ({ ...prev, [t.id]: all }))
        })
      }
    })
  }, [reviewTasks.length])

  // Init layouts
  useEffect(() => {
    // Task slides
    reviewTasks.forEach(t => {
      const media = wipCache[t.id] || []
      const existing = layouts[t.id]
      if (!existing) {
        if (t.slide_layout?.elements) {
          const dbHasMedia = t.slide_layout.elements.some(e => e.type === 'image' || e.type === 'audio')
          if (!dbHasMedia && media.length > 0) {
            setLayouts(prev => ({ ...prev, [t.id]: defaultLayout(t, media) }))
          } else {
            setLayouts(prev => ({ ...prev, [t.id]: t.slide_layout }))
          }
        } else {
          setLayouts(prev => ({ ...prev, [t.id]: defaultLayout(t, media) }))
        }
      } else {
        const hasMediaEls = existing.elements?.some(e => e.type === 'image' || e.type === 'audio')
        if (!hasMediaEls && media.length > 0) {
          setLayouts(prev => ({ ...prev, [t.id]: defaultLayout(t, media) }))
        }
      }
    })
    // Custom slides
    customSlides.forEach(c => {
      if (!layouts[c.id]) {
        setLayouts(prev => ({ ...prev, [c.id]: c.layout || { elements: [{ id: 'title', type: 'custom_text', x: CW/2-200, y: CH/2-30, w: 400, h: 60, fontSize: 28, text: c.title || 'New Slide', color: '#1a1a1a' }], bg: '#FFFFFF' } }))
      }
    })
  }, [reviewTasks.length, customSlides.length, Object.keys(wipCache).length])

  const activeSlide = allSlides[selectedSlide] || null
  const activeId = activeSlide?.id
  const activeTask = activeSlide?.type === 'task' ? activeSlide.task : null
  const activeLayout = activeId ? layouts[activeId] : null

  // Save layout
  const saveLayout = useCallback((slideId, layout) => {
    setLayouts(prev => ({ ...prev, [slideId]: layout }))
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      // If task slide, save to DB
      const isTask = reviewTasks.some(t => t.id === slideId)
      if (isTask) updateSlideLayout(slideId, layout)
      // If custom, save to localStorage
      else {
        setCustomSlides(prev => {
          const updated = prev.map(c => c.id === slideId ? { ...c, layout } : c)
          saveCustomSlides(updated)
          return updated
        })
      }
    }, 800)
  }, [reviewTasks])

  const resetLayout = useCallback((slideId) => {
    const t = reviewTasks.find(tt => tt.id === slideId)
    const media = wipCache[slideId] || []
    saveLayout(slideId, defaultLayout(t || null, media))
  }, [reviewTasks, wipCache, saveLayout])

  // Update element
  const updateElement = useCallback((elId, updates) => {
    if (!activeId) return
    const layout = layouts[activeId]
    if (!layout) return
    const newEls = layout.elements.map(e => {
      if (e.id !== elId) return e
      return { ...e, ...updates }
    })
    saveLayout(activeId, { ...layout, elements: newEls })
  }, [activeId, layouts, saveLayout])

  // Add element
  const addElement = useCallback((type) => {
    if (!activeId || !activeLayout) return
    const id = `${type}_${Date.now()}`
    let newEl
    if (type === 'text') newEl = { id, type: 'custom_text', x: CW/2-100, y: CH/2-20, w: 200, h: 40, fontSize: 16, text: 'Text', color: '#1a1a1a' }
    else if (type === 'shape') newEl = { id, type: 'shape', x: CW/2-75, y: CH/2-40, w: 150, h: 80, color: '#E2E8F0', borderColor: '#94A3B8' }
    if (!newEl) return
    saveLayout(activeId, { ...activeLayout, elements: [...activeLayout.elements, newEl] })
    setSelectedEl(id)
  }, [activeId, activeLayout, saveLayout])

  // Delete element
  const deleteSelectedElement = useCallback(() => {
    if (!activeId || !activeLayout || !selectedEl) return
    saveLayout(activeId, { ...activeLayout, elements: activeLayout.elements.filter(e => e.id !== selectedEl) })
    setSelectedEl(null)
  }, [activeId, activeLayout, selectedEl, saveLayout])

  // Add blank slide
  const addBlankSlide = () => {
    const id = `custom_${Date.now()}`
    const newSlide = { id, title: 'Blank Slide', layout: { elements: [{ id: 'title', type: 'custom_text', x: CW/2-200, y: CH/2-30, w: 400, h: 60, fontSize: 28, text: 'New Slide', color: '#1a1a1a' }], bg: '#FFFFFF' } }
    const updated = [...customSlides, newSlide]
    setCustomSlides(updated)
    saveCustomSlides(updated)
    setOrder(prev => [...prev, id])
    setTimeout(() => setSelectedSlide(allSlides.length), 50)
  }

  // Delete custom slide
  const deleteCustomSlide = (slideId) => {
    const updated = customSlides.filter(c => c.id !== slideId)
    setCustomSlides(updated)
    saveCustomSlides(updated)
    setOrder(prev => prev.filter(id => id !== slideId))
    setLayouts(prev => { const n = { ...prev }; delete n[slideId]; return n })
    setSelectedSlide(0)
    setSelectedEl(null)
  }

  const toggleSkip = (slideId) => {
    setSkippedSlides(prev => {
      const next = new Set(prev)
      if (next.has(slideId)) next.delete(slideId); else next.add(slideId)
      localStorage.setItem('review_skipped', JSON.stringify([...next]))
      return next
    })
  }

  // Slide drag reorder
  const handleSlideDragStart = (idx) => setDragSlideIdx(idx)
  const handleSlideDragOver = (e, idx) => { e.preventDefault(); setDragOverSlideIdx(idx) }
  const handleSlideDrop = (idx) => {
    if (dragSlideIdx === null || dragSlideIdx === idx) return
    const newOrder = allSlides.map(s => s.id)
    const [moved] = newOrder.splice(dragSlideIdx, 1)
    newOrder.splice(idx, 0, moved)
    setOrder(newOrder)
    setSelectedSlide(idx)
    setDragSlideIdx(null); setDragOverSlideIdx(null)
  }

  // Presentation — only non-skipped slides
  const presentSlides = allSlides.filter(s => !skippedSlides.has(s.id))
  const [presCommentOpen, setPresCommentOpen] = useState(false)
  const [presComment, setPresComment] = useState('')
  const [presActionLoading, setPresActionLoading] = useState(null)
  const presCommentRef = useRef(null)

  const startPresentation = () => {
    setCurrentSlide(0); setPresenting(true); setPresCommentOpen(false); setPresComment('')
    document.documentElement.requestFullscreen?.().catch(() => {})
  }
  const exitPresentation = useCallback(() => {
    setPresenting(false); setPresCommentOpen(false); setPresComment('')
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {})
  }, [])
  const nextSlide = useCallback(() => setCurrentSlide(s => Math.min(s + 1, presentSlides.length)), [presentSlides.length]) // +1 for end slide
  const prevSlide = useCallback(() => setCurrentSlide(s => Math.max(s - 1, 0)), [])

  const [presFeedback, setPresFeedback] = useState(null) // { text, color, icon }

  const handlePresApprove = async (taskId) => {
    setPresActionLoading('approve')
    try {
      await onUpdateTask(taskId, { status: 'approved' })
    } catch (e) { console.error(e) }
    setPresActionLoading(null)
    setPresFeedback({ text: 'Task approvato!', color: '#22C55E', icon: '✓' })
    setTimeout(() => setPresFeedback(null), 2500)
  }
  const handlePresReject = async (taskId) => {
    const comment = presComment.trim()
    setPresCommentOpen(false)
    setPresComment('')
    setPresActionLoading('reject')
    try {
      await onRejectTask(taskId, comment)
    } catch (e) { console.error(e) }
    setPresActionLoading(null)
    setPresFeedback({ text: 'Modifiche richieste', color: '#F59E0B', icon: '↩' })
    setTimeout(() => setPresFeedback(null), 2500)
  }

  useEffect(() => {
    if (!presenting) return
    const onKey = (e) => {
      // Don't navigate when typing in comment box
      if (presCommentOpen) {
        if (e.key === 'Escape') { e.preventDefault(); setPresCommentOpen(false); setPresComment('') }
        return
      }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); nextSlide() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prevSlide() }
      else if (e.key === 'Escape') { e.preventDefault(); exitPresentation() }
    }
    // Also exit presentation when browser exits fullscreen (user presses F11)
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && presenting) exitPresentation()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('fullscreenchange', onFullscreenChange) }
  }, [presenting, presCommentOpen, nextSlide, prevSlide, exitPresentation])

  // Add a fixed "Fine Review" end slide to presentation
  const END_SLIDE = { id: '__end__', type: 'end' }
  const presentSlidesWithEnd = [...presentSlides, END_SLIDE]

  // Clamp currentSlide if slides shrink (task approved/rejected removes it)
  useEffect(() => {
    if (presenting && currentSlide >= presentSlidesWithEnd.length && presentSlidesWithEnd.length > 0) {
      setCurrentSlide(presentSlidesWithEnd.length - 1)
    }
  }, [presenting, currentSlide, presentSlidesWithEnd.length])

  // ═══════════════════════════════
  // FULLSCREEN PRESENTATION
  // ═══════════════════════════════
  if (presenting && presentSlidesWithEnd.length > 0) {
    const slide = presentSlidesWithEnd[currentSlide] || END_SLIDE
    const layout = slide.type === 'end' ? null : layouts[slide.id]
    const task = slide.type === 'task' ? slide.task : null
    const scale = Math.min(window.innerWidth / CW, window.innerHeight / CH)

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: CW * scale, height: CH * scale, position: 'relative', background: slide.type === 'end' ? '#1a1a1a' : (layout?.bg || '#FFF'), overflow: 'hidden' }}>
          {slide.type === 'end' ? (
            /* End slide */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
              <div style={{ fontSize: 48 * scale, fontWeight: 800, color: '#fff', letterSpacing: 2 }}>Fine Review</div>
              <div style={{ fontSize: 18 * scale, color: '#94A3B8', marginTop: 16 * scale }}>Premi ESC per uscire</div>
            </div>
          ) : (
            <>
              {/* Arrows */}
              {layout?.elements?.filter(e => e.type === 'arrow').map(el => (
                <svg key={el.id} style={{ position: 'absolute', inset: 0, width: CW * scale, height: CH * scale, pointerEvents: 'none' }}>
                  <defs><marker id={`pah_${el.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill={el.color || '#1a1a1a'} /></marker></defs>
                  <line x1={(el.x1||0)*scale} y1={(el.y1||0)*scale} x2={(el.x2||0)*scale} y2={(el.y2||0)*scale} stroke={el.color||'#1a1a1a'} strokeWidth={el.strokeWidth||3} markerEnd={`url(#pah_${el.id})`} />
                </svg>
              ))}
              {/* Other elements */}
              {layout?.elements?.filter(e => e.type !== 'arrow').map(el => (
                <div key={el.id} style={{ position: 'absolute', left: el.x * scale, top: el.y * scale, width: el.w * scale, height: el.h * scale, zIndex: el.type === 'shape' ? 0 : 1 }}>
                  <ElementRender el={el} task={task} profiles={profiles} scale={scale} />
                </div>
              ))}
            </>
          )}
        </div>
        {/* Bottom navigation bar */}
        <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(0,0,0,0.6)', borderRadius: 24, padding: '8px 20px' }}
          onClick={e => e.stopPropagation()}>
          <button onClick={prevSlide} style={presBtn}>←</button>
          <span style={{ color: '#fff', fontSize: 13, minWidth: 60, textAlign: 'center' }}>{currentSlide + 1} / {presentSlidesWithEnd.length}</span>
          <button onClick={nextSlide} style={presBtn}>→</button>
          {/* Review action buttons — only for task slides */}
          {task && task.status === 'review' && (
            <>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.3)' }} />
              <button
                disabled={presActionLoading === 'approve'}
                onClick={() => handlePresApprove(task.id)}
                style={{ ...presBtn, background: '#22C55E', color: '#fff', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: 600, opacity: presActionLoading === 'approve' ? 0.5 : 1 }}>
                {presActionLoading === 'approve' ? '...' : '✓ Approva'}
              </button>
              <button
                onClick={() => { setPresCommentOpen(true); setTimeout(() => presCommentRef.current?.focus(), 50) }}
                style={{ ...presBtn, background: '#F59E0B', color: '#fff', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: 600 }}>
                Da modificare
              </button>
            </>
          )}
          {task && task.status === 'approved' && (
            <>
              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.3)' }} />
              <span style={{ color: '#22C55E', fontSize: 13, fontWeight: 600 }}>✓ Approvato</span>
            </>
          )}
          <button onClick={exitPresentation} style={{ ...presBtn, color: '#EF4444' }}>✕</button>
        </div>

        {/* Feedback toast */}
        {presFeedback && (
          <>
            <style>{`@keyframes presFeedbackIn { from { opacity:0; transform:translate(-50%,-50%) scale(0.7); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }`}</style>
            <div style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              zIndex: 10001, display: 'flex', alignItems: 'center', gap: 16,
              background: presFeedback.color, color: '#fff', borderRadius: 20,
              padding: '24px 48px', boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
              animation: 'presFeedbackIn 0.3s ease',
            }}>
              <span style={{ fontSize: 40 }}>{presFeedback.icon}</span>
              <span style={{ fontSize: 24, fontWeight: 700 }}>{presFeedback.text}</span>
            </div>
          </>
        )}

        {/* Comment overlay for "Da modificare" */}
        {presCommentOpen && task && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => { setPresCommentOpen(false); setPresComment('') }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: 16, padding: 28, width: 480, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: 18, color: '#1a1a1a' }}>Modifiche richieste</h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#64748B' }}>Inserisci un commento per lo studente su cosa modificare</p>
              <textarea
                ref={presCommentRef}
                value={presComment}
                onChange={e => setPresComment(e.target.value)}
                placeholder="Commento..."
                style={{ width: '100%', minHeight: 100, borderRadius: 10, border: '1px solid #CBD5E1', padding: 14, fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
                <button onClick={() => { setPresCommentOpen(false); setPresComment('') }}
                  style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #CBD5E1', background: '#fff', color: '#64748B', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                  Annulla
                </button>
                <button
                  disabled={presActionLoading === 'reject'}
                  onClick={() => handlePresReject(task.id)}
                  style={{ padding: '10px 24px', borderRadius: 10, border: 'none', background: '#F59E0B', color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 700, opacity: presActionLoading === 'reject' ? 0.5 : 1 }}>
                  {presActionLoading === 'reject' ? 'Invio...' : 'Invia'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ═══════════════════════════════
  // EDITOR
  // ═══════════════════════════════
  if (allSlides.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <EmptyState icon={<IconEye size={48} color="#94A3B8" />} title="No slides" sub="Tasks in review status will appear here as slides" />
        <button onClick={addBlankSlide} style={{ ...tbBtn, marginTop: 20, padding: '10px 24px', fontSize: 14 }}>+ Add Blank Slide</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', gap: 0, margin: '-36px -44px', background: '#E8ECF1' }}>
      {/* LEFT: Slide panel */}
      <div style={{ width: 280, flexShrink: 0, background: '#F8FAFC', borderRight: '1px solid #E2E8F0', overflowY: 'auto', padding: '12px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 4px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Slides</span>
          <button onClick={startPresentation} style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>▶ Present</button>
        </div>
        {allSlides.map((slide, idx) => {
          const isActive = idx === selectedSlide
          const isDragOver = dragOverSlideIdx === idx && dragSlideIdx !== idx
          const task = slide.type === 'task' ? slide.task : null
          const dept = task ? DEPTS.find(d => d.id === task.department) : null
          const title = task ? (task.review_title || task.title) : (slide.title || 'Blank Slide')
          const isSkipped = skippedSlides.has(slide.id)
          return (
            <div key={slide.id} draggable
              onDragStart={() => handleSlideDragStart(idx)}
              onDragOver={e => handleSlideDragOver(e, idx)}
              onDragEnd={() => { setDragSlideIdx(null); setDragOverSlideIdx(null) }}
              onDrop={() => handleSlideDrop(idx)}
              onClick={() => { setSelectedSlide(idx); setSelectedEl(null) }}
              style={{
                display: 'flex', gap: 6, alignItems: 'center',
                padding: 4, marginBottom: 4, borderRadius: 6, cursor: 'pointer',
                border: isActive ? `2px solid ${ACCENT}` : isDragOver ? `2px solid #60A5FA` : '2px solid transparent',
                background: isActive ? '#FFF' : 'transparent',
              }}>
              <input type="checkbox" checked={!isSkipped}
                onChange={(e) => { e.stopPropagation(); toggleSkip(slide.id) }}
                title={isSkipped ? 'Enable in presentation' : 'Skip in presentation'}
                style={{ accentColor: ACCENT, width: 14, height: 14, flexShrink: 0, cursor: 'pointer' }} />
              <div style={{ flex: 1, minWidth: 0, opacity: isSkipped ? 0.35 : 1 }}>
                <div style={{ width: '100%', aspectRatio: '16/9', background: layouts[slide.id]?.bg || '#fff', borderRadius: 3, position: 'relative', overflow: 'hidden', border: '1px solid #1a1a1a' }}>
                  <MiniPreview layout={layouts[slide.id]} task={task} dept={dept} profiles={profiles} />
                </div>
              </div>
            </div>
          )
        })}
        <button onClick={addBlankSlide} style={{ width: '100%', padding: '8px 0', border: '1px dashed #CBD5E1', borderRadius: 6, background: 'none', fontSize: 11, color: '#94A3B8', cursor: 'pointer', marginTop: 4 }}>+ Blank Slide</button>
      </div>

      {/* CENTER: Canvas + toolbar */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 12, minWidth: 0, gap: 8 }}>
        {/* Toolbar */}
        {activeId && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => addElement('text')} style={tbBtn} title="Add text">T+</button>
            <button onClick={() => setActiveTool(activeTool === 'arrow' ? null : 'arrow')}
              style={{ ...tbBtn, background: activeTool === 'arrow' ? ACCENT : '#fff', color: activeTool === 'arrow' ? '#fff' : '#475569' }}
              title="Draw arrow: click and drag on canvas">↗</button>
            <button onClick={() => addElement('shape')} style={tbBtn} title="Rectangle (goes behind other elements)">□</button>
            <div style={{ width: 1, height: 20, background: '#E2E8F0', margin: '0 2px' }} />
            {selectedEl && activeLayout && (() => {
              const el = activeLayout.elements.find(e => e.id === selectedEl)
              return el && el.type !== 'arrow' ? <>
                <button onClick={() => updateElement(selectedEl, { x: 0 })} style={tbBtn} title="Align left">⫷</button>
                <button onClick={() => updateElement(selectedEl, { x: Math.round((CW - el.w) / 2) })} style={tbBtn} title="Align center">⫿</button>
                <button onClick={() => updateElement(selectedEl, { x: CW - el.w })} style={tbBtn} title="Align right">⫸</button>
                <button onClick={() => updateElement(selectedEl, { y: Math.round((CH - el.h) / 2) })} style={tbBtn} title="Center vertical">⫼</button>
                <div style={{ width: 1, height: 20, background: '#E2E8F0', margin: '0 2px' }} />
              </> : null
            })()}
            {selectedEl && <button onClick={deleteSelectedElement} style={{ ...tbBtn, color: '#EF4444', borderColor: '#FCA5A5' }}>🗑</button>}
            {activeSlide?.type === 'custom' && (
              <button onClick={() => deleteCustomSlide(activeId)} style={{ ...tbBtn, color: '#EF4444', borderColor: '#FCA5A5', marginLeft: 8 }}>Delete Slide</button>
            )}
          </div>
        )}
        {/* Canvas area with extra overflow space */}
        <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'visible' }}>
          {activeId && activeLayout && (
            <SlideCanvas
              slideId={activeId}
              task={activeTask}
              layout={activeLayout}
              profiles={profiles}
              selectedEl={selectedEl}
              onSelectEl={setSelectedEl}
              onUpdateElement={updateElement}
              onUpdateReviewMeta={onUpdateReviewMeta}
              activeTool={activeTool}
              onAddArrow={(arrow) => {
                const newLayout = { ...activeLayout, elements: [...activeLayout.elements, arrow] }
                saveLayout(activeId, newLayout)
                setSelectedEl(arrow.id)
                setActiveTool(null)
              }}
            />
          )}
        </div>
      </div>

      {/* RIGHT: Properties */}
      <div style={{ width: 260, flexShrink: 0, background: '#F8FAFC', borderLeft: '1px solid #E2E8F0', overflowY: 'auto', padding: 14 }}>
        {selectedEl && activeLayout ? (
          <PropertiesPanel el={activeLayout.elements.find(e => e.id === selectedEl)} onUpdate={(u) => updateElement(selectedEl, u)} layout={activeLayout} onBgChange={(bg) => { if (activeId) saveLayout(activeId, { ...activeLayout, bg }) }} />
        ) : (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 10, textTransform: 'uppercase' }}>Slide</div>
            {activeLayout && (
              <>
                <label style={propLabel}>Background</label>
                <input type="color" value={activeLayout.bg || '#FFFFFF'} onChange={e => { if (activeId) saveLayout(activeId, { ...activeLayout, bg: e.target.value }) }}
                  style={{ width: '100%', height: 28, border: '1px solid #E2E8F0', borderRadius: 6, cursor: 'pointer' }} />
              </>
            )}
            <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 12 }}>Click element to edit</div>
            {activeId && <button onClick={() => requestConfirm?.('Reset Slide? All element positions will be reset to default.', () => resetLayout(activeId))} style={{ marginTop: 12, width: '100%', padding: '6px 10px', borderRadius: 6, border: '1px solid #FCA5A5', background: '#FEF2F2', fontSize: 10, fontWeight: 600, color: '#EF4444', cursor: 'pointer' }}>Reset Slide</button>}
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════
// SLIDE CANVAS
// ═══════════════════════════════
function SlideCanvas({ slideId, task, layout, profiles, selectedEl, onSelectEl, onUpdateElement, onUpdateReviewMeta, activeTool, onAddArrow }) {
  const containerRef = useRef(null)
  const canvasBoxRef = useRef(null)
  const [scale, setScale] = useState(1)
  const [dragging, setDragging] = useState(null)
  const [resizing, setResizing] = useState(null)
  const [editingText, setEditingText] = useState(null)
  const [drawingArrow, setDrawingArrow] = useState(null) // { x1, y1, x2, y2 }

  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setScale(Math.min((r.width - 40) / CW, (r.height - 20) / CH, 1.2))
    })
    ro.observe(el); return () => ro.disconnect()
  }, [])

  // Arrow drawing on canvas
  const handleCanvasMouseDown = (e) => {
    if (activeTool === 'arrow' && canvasBoxRef.current) {
      e.preventDefault()
      const rect = canvasBoxRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / scale
      const y = (e.clientY - rect.top) / scale
      setDrawingArrow({ x1: Math.round(x), y1: Math.round(y), x2: Math.round(x), y2: Math.round(y) })
      onSelectEl(null)
      return
    }
    onSelectEl(null)
  }

  useEffect(() => {
    if (!drawingArrow) return
    const onMove = (e) => {
      if (!canvasBoxRef.current) return
      const rect = canvasBoxRef.current.getBoundingClientRect()
      const x = (e.clientX - rect.left) / scale
      const y = (e.clientY - rect.top) / scale
      setDrawingArrow(prev => ({ ...prev, x2: Math.round(x), y2: Math.round(y) }))
    }
    const onUp = () => {
      if (drawingArrow) {
        const dx = drawingArrow.x2 - drawingArrow.x1, dy = drawingArrow.y2 - drawingArrow.y1
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len > 10) {
          onAddArrow({ id: `arrow_${Date.now()}`, type: 'arrow', x1: drawingArrow.x1, y1: drawingArrow.y1, x2: drawingArrow.x2, y2: drawingArrow.y2, color: '#1a1a1a', strokeWidth: 3 })
        }
      }
      setDrawingArrow(null)
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [drawingArrow, scale, onAddArrow])

  const [snapLines, setSnapLines] = useState([]) // { axis: 'x'|'y', pos: number }
  const SNAP_DIST = 6

  // Compute snap targets from other elements + canvas edges/center
  const getSnapTargets = (excludeId) => {
    const targets = { x: [0, CW / 2, CW], y: [0, CH / 2, CH] }
    ;(layout.elements || []).forEach(el => {
      if (el.id === excludeId || el.type === 'arrow') return
      targets.x.push(el.x, el.x + el.w / 2, el.x + el.w)
      targets.y.push(el.y, el.y + el.h / 2, el.y + el.h)
    })
    return targets
  }

  const snapValue = (val, targets) => {
    for (const t of targets) {
      if (Math.abs(val - t) < SNAP_DIST) return { snapped: t, guide: t }
    }
    return { snapped: val, guide: null }
  }

  const snapElement = (el, newX, newY, targets) => {
    const guides = []
    // Snap left, center, right edges
    const xEdges = [newX, newX + el.w / 2, newX + el.w]
    const yEdges = [newY, newY + el.h / 2, newY + el.h]
    let sx = newX, sy = newY
    for (const xe of xEdges) {
      const r = snapValue(xe, targets.x)
      if (r.guide !== null) { sx = newX + (r.snapped - xe); guides.push({ axis: 'x', pos: r.guide }); break }
    }
    for (const ye of yEdges) {
      const r = snapValue(ye, targets.y)
      if (r.guide !== null) { sy = newY + (r.snapped - ye); guides.push({ axis: 'y', pos: r.guide }); break }
    }
    return { x: Math.round(sx), y: Math.round(sy), guides }
  }

  const handleMouseDown = (e, el) => {
    if (activeTool === 'arrow') return
    e.stopPropagation(); onSelectEl(el.id)
    if (editingText === el.id) return
    setDragging({ id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, el })
  }

  // corner: 'tl' | 'tr' | 'bl' | 'br'
  const handleResizeStart = (e, el, corner) => {
    e.stopPropagation(); e.preventDefault()
    setResizing({ id: el.id, corner, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, origW: el.w, origH: el.h })
  }

  useEffect(() => {
    if (!dragging && !resizing) return
    const onMove = (e) => {
      if (dragging) {
        const dx = (e.clientX - dragging.startX) / scale, dy = (e.clientY - dragging.startY) / scale
        const targets = getSnapTargets(dragging.id)
        const { x, y, guides } = snapElement(dragging.el, dragging.origX + dx, dragging.origY + dy, targets)
        onUpdateElement(dragging.id, { x, y })
        setSnapLines(guides)
      }
      if (resizing) {
        const dx = (e.clientX - resizing.startX) / scale, dy = (e.clientY - resizing.startY) / scale
        const c = resizing.corner
        let { origX: ox, origY: oy, origW: ow, origH: oh } = resizing
        let nx = ox, ny = oy, nw = ow, nh = oh
        if (c === 'br') { nw = ow + dx; nh = oh + dy }
        else if (c === 'bl') { nx = ox + dx; nw = ow - dx; nh = oh + dy }
        else if (c === 'tr') { ny = oy + dy; nw = ow + dx; nh = oh - dy }
        else if (c === 'tl') { nx = ox + dx; ny = oy + dy; nw = ow - dx; nh = oh - dy }
        nw = Math.max(20, nw); nh = Math.max(20, nh)
        onUpdateElement(resizing.id, { x: Math.round(nx), y: Math.round(ny), w: Math.round(nw), h: Math.round(nh) })
      }
    }
    const onUp = () => { setDragging(null); setResizing(null); setSnapLines([]) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [dragging, resizing, scale, onUpdateElement])

  // Arrow drag: move whole arrow
  const [arrowDrag, setArrowDrag] = useState(null)
  const handleArrowDragStart = (e, el) => {
    onSelectEl(el.id)
    setArrowDrag({ id: el.id, startX: e.clientX, startY: e.clientY, origX1: el.x1, origY1: el.y1, origX2: el.x2, origY2: el.y2 })
  }
  // Arrow endpoint drag
  const [endpointDrag, setEndpointDrag] = useState(null)
  const handleArrowEndpointDrag = (e, el, which) => {
    setEndpointDrag({ id: el.id, which, startX: e.clientX, startY: e.clientY, origX1: el.x1, origY1: el.y1, origX2: el.x2, origY2: el.y2 })
  }

  useEffect(() => {
    if (!arrowDrag && !endpointDrag) return
    const onMove = (e) => {
      if (arrowDrag) {
        const dx = (e.clientX - arrowDrag.startX) / scale, dy = (e.clientY - arrowDrag.startY) / scale
        onUpdateElement(arrowDrag.id, { x1: Math.round(arrowDrag.origX1 + dx), y1: Math.round(arrowDrag.origY1 + dy), x2: Math.round(arrowDrag.origX2 + dx), y2: Math.round(arrowDrag.origY2 + dy) })
      }
      if (endpointDrag) {
        const dx = (e.clientX - endpointDrag.startX) / scale, dy = (e.clientY - endpointDrag.startY) / scale
        if (endpointDrag.which === 'start') onUpdateElement(endpointDrag.id, { x1: Math.round(endpointDrag.origX1 + dx), y1: Math.round(endpointDrag.origY1 + dy) })
        else onUpdateElement(endpointDrag.id, { x2: Math.round(endpointDrag.origX2 + dx), y2: Math.round(endpointDrag.origY2 + dy) })
      }
    }
    const onUp = () => { setArrowDrag(null); setEndpointDrag(null) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [arrowDrag, endpointDrag, scale, onUpdateElement])

  const handleDoubleClick = (el) => { if (el.type === 'title' || el.type === 'description' || el.type === 'custom_text') setEditingText(el.id) }
  const handleTextBlur = (el, value) => {
    setEditingText(null)
    if (el.type === 'custom_text') { onUpdateElement(el.id, { text: value }); return }
    if (!task) return
    if (el.type === 'title') onUpdateReviewMeta(task.id, value, task.review_description || task.description || '')
    else if (el.type === 'description') onUpdateReviewMeta(task.id, task.review_title || task.title, value)
  }

  // Sort: shapes first (behind), then rest
  const sortedEls = [...(layout.elements || [])].sort((a, b) => {
    if (a.type === 'shape' && b.type !== 'shape') return -1
    if (b.type === 'shape' && a.type !== 'shape') return 1
    return 0
  })

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
      onClick={() => { if (activeTool !== 'arrow') onSelectEl(null) }}>
      {/* Canvas with visible overflow */}
      <div ref={canvasBoxRef} onMouseDown={handleCanvasMouseDown}
        style={{ width: CW * scale, height: CH * scale, position: 'relative', background: layout.bg || '#FFF', borderRadius: 6, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', overflow: 'visible', flexShrink: 0, cursor: activeTool === 'arrow' ? 'crosshair' : 'default' }}>
        {/* Canvas border indicator */}
        <div style={{ position: 'absolute', inset: 0, border: '1px solid #D1D5DB', borderRadius: 6, pointerEvents: 'none', zIndex: 100 }} />
        {/* Drawing arrow preview */}
        {drawingArrow && (
          <svg style={{ position: 'absolute', inset: 0, width: CW * scale, height: CH * scale, pointerEvents: 'none', zIndex: 200 }}>
            <defs><marker id="draw_ah" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="#1a1a1a" /></marker></defs>
            <line x1={drawingArrow.x1 * scale} y1={drawingArrow.y1 * scale} x2={drawingArrow.x2 * scale} y2={drawingArrow.y2 * scale} stroke="#1a1a1a" strokeWidth={3} markerEnd="url(#draw_ah)" />
          </svg>
        )}
        {/* Arrow elements rendered as SVG overlay */}
        {sortedEls.filter(el => el.type === 'arrow').map(el => {
          const isSelected = selectedEl === el.id
          const c = el.color || '#1a1a1a'
          const sw = el.strokeWidth || 3
          // Arrow uses x1,y1,x2,y2 — render as full-canvas SVG
          return (
            <svg key={el.id} style={{ position: 'absolute', inset: 0, width: CW * scale, height: CH * scale, pointerEvents: 'none', zIndex: isSelected ? 50 : 5 }}>
              <defs><marker id={`ah_${el.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill={c} /></marker></defs>
              {/* Invisible fat line for easy clicking */}
              <line x1={(el.x1||0)*scale} y1={(el.y1||0)*scale} x2={(el.x2||0)*scale} y2={(el.y2||0)*scale}
                stroke="transparent" strokeWidth={20} style={{ pointerEvents: 'stroke', cursor: 'grab' }}
                onMouseDown={e => { e.stopPropagation(); handleArrowDragStart(e, el) }}
                onClick={e => { e.stopPropagation(); onSelectEl(el.id) }} />
              {/* Visible arrow */}
              <line x1={(el.x1||0)*scale} y1={(el.y1||0)*scale} x2={(el.x2||0)*scale} y2={(el.y2||0)*scale}
                stroke={c} strokeWidth={sw} markerEnd={`url(#ah_${el.id})`} style={{ pointerEvents: 'none' }} />
              {/* Selection dots at endpoints */}
              {isSelected && <>
                <circle cx={(el.x1||0)*scale} cy={(el.y1||0)*scale} r={5} fill={ACCENT} style={{ pointerEvents: 'all', cursor: 'move' }}
                  onMouseDown={e => { e.stopPropagation(); handleArrowEndpointDrag(e, el, 'start') }} />
                <circle cx={(el.x2||0)*scale} cy={(el.y2||0)*scale} r={5} fill={ACCENT} style={{ pointerEvents: 'all', cursor: 'move' }}
                  onMouseDown={e => { e.stopPropagation(); handleArrowEndpointDrag(e, el, 'end') }} />
              </>}
            </svg>
          )
        })}
        {/* Non-arrow elements */}
        {sortedEls.filter(el => el.type !== 'arrow').map((el, zIdx) => {
          const isSelected = selectedEl === el.id
          const isEditingThis = editingText === el.id
          const isOutside = (el.x + el.w < 0 || el.x > CW || el.y + el.h < 0 || el.y > CH)
          return (
            <div key={el.id} style={{
              position: 'absolute', left: el.x * scale, top: el.y * scale, width: el.w * scale, height: el.h * scale,
              cursor: activeTool ? 'crosshair' : dragging ? 'grabbing' : 'grab',
              outline: isSelected ? `2px solid ${ACCENT}` : isOutside ? '2px dashed #94A3B8' : 'none',
              borderRadius: 4, zIndex: el.type === 'shape' ? 0 : (isSelected ? 50 : zIdx + 10),
            }}
              onMouseDown={e => handleMouseDown(e, el)}
              onDoubleClick={() => handleDoubleClick(el)}
              onClick={e => e.stopPropagation()}>
              <ElementRender el={el} task={task} profiles={profiles} scale={scale} isEditing={isEditingThis} onTextBlur={(val) => handleTextBlur(el, val)} />
              {isSelected && !isEditingThis && <>
                <div onMouseDown={e => handleResizeStart(e, el, 'tl')} style={{ ...resizeHandle, top: -5, left: -5, cursor: 'nwse-resize' }} />
                <div onMouseDown={e => handleResizeStart(e, el, 'tr')} style={{ ...resizeHandle, top: -5, right: -5, cursor: 'nesw-resize' }} />
                <div onMouseDown={e => handleResizeStart(e, el, 'bl')} style={{ ...resizeHandle, bottom: -5, left: -5, cursor: 'nesw-resize' }} />
                <div onMouseDown={e => handleResizeStart(e, el, 'br')} style={{ ...resizeHandle, bottom: -5, right: -5, cursor: 'nwse-resize' }} />
              </>}
            </div>
          )
        })}
        {/* Snap guide lines */}
        {snapLines.map((g, i) => (
          g.axis === 'x'
            ? <div key={`sg${i}`} style={{ position: 'absolute', left: g.pos * scale, top: 0, width: 1, height: CH * scale, background: '#F28C28', opacity: 0.6, pointerEvents: 'none', zIndex: 999 }} />
            : <div key={`sg${i}`} style={{ position: 'absolute', top: g.pos * scale, left: 0, height: 1, width: CW * scale, background: '#F28C28', opacity: 0.6, pointerEvents: 'none', zIndex: 999 }} />
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════
// ELEMENT RENDER
// ═══════════════════════════════
function ElementRender({ el, task, profiles, scale, isEditing, onTextBlur }) {
  const fs = (el.fontSize || 14) * scale
  const dept = task ? DEPTS.find(d => d.id === task.department) : null
  const student = task ? profiles.find(p => p.id === task.assigned_to) : null

  if (el.type === 'title' && task) {
    const text = task.review_title || task.title
    const ta = el.textAlign || 'left'
    if (isEditing) return <input defaultValue={text} autoFocus onBlur={e => onTextBlur(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }} style={{ width: '100%', height: '100%', fontSize: fs, fontWeight: 700, color: '#1a1a1a', border: 'none', outline: 'none', background: 'rgba(255,255,255,0.8)', padding: '4px 8px', borderRadius: 4, textAlign: ta }} />
    return <div style={{ fontSize: fs, fontWeight: 700, color: '#1a1a1a', overflow: 'hidden', padding: '4px 8px', lineHeight: 1.3, textAlign: ta }}>{text}</div>
  }
  if (el.type === 'description' && task) {
    const text = task.review_description || task.description || ''
    const ta = el.textAlign || 'left'
    if (isEditing) return <textarea defaultValue={text} autoFocus onBlur={e => onTextBlur(e.target.value)} style={{ width: '100%', height: '100%', fontSize: fs, color: '#475569', border: 'none', outline: 'none', background: 'rgba(255,255,255,0.8)', padding: '4px 8px', borderRadius: 4, resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, textAlign: ta }} />
    return <div style={{ fontSize: fs, color: '#475569', overflow: 'hidden', padding: '4px 8px', lineHeight: 1.5, textAlign: ta }}>{text || 'Double-click to edit'}</div>
  }
  if (el.type === 'badge' && dept) {
    return <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: '0 8px' }}><span style={{ fontSize: Math.max(10, 11 * scale), fontWeight: 700, color: '#fff', background: dept.color, padding: '3px 12px', borderRadius: 6 }}>{dept.label.toUpperCase()}</span></div>
  }
  if (el.type === 'student' && student) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 6 * scale, height: '100%', justifyContent: 'flex-end', padding: '0 8px' }}><Av name={student.full_name} size={Math.max(16, 22 * scale)} url={student.avatar_url} /><span style={{ fontSize: Math.max(10, 12 * scale), color: '#64748B', fontWeight: 500 }}>{student.full_name}</span></div>
  }
  if (el.type === 'image') {
    if (isVideoUrl(el.src)) return <video src={el.src} controls style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6, background: '#F1F5F9' }} onClick={e => e.stopPropagation()} />
    return <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6, background: '#F1F5F9' }} draggable={false} />
  }
  if (el.type === 'audio') {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%', background: '#F1F5F9', borderRadius: 8, padding: '0 12px' }} onClick={e => e.stopPropagation()}><span style={{ fontSize: 16 }}>♫</span><audio controls src={el.src} style={{ flex: 1, height: 28 }} preload="metadata" /></div>
  }
  if (el.type === 'custom_text') {
    const ta = el.textAlign || 'left'
    if (isEditing) return <input defaultValue={el.text || 'Text'} autoFocus onBlur={e => onTextBlur(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }} style={{ width: '100%', height: '100%', fontSize: fs, fontWeight: 600, color: el.color || '#1a1a1a', border: 'none', outline: 'none', background: 'rgba(255,255,255,0.8)', padding: '4px 8px', borderRadius: 4, textAlign: ta }} />
    return <div style={{ fontSize: fs, fontWeight: 600, color: el.color || '#1a1a1a', overflow: 'hidden', padding: '4px 8px', lineHeight: 1.4, textAlign: ta }}>{el.text || 'Text'}</div>
  }
  // Arrow type is not rendered here — it's rendered as SVG overlay in SlideCanvas/Presentation
  if (el.type === 'arrow') return null
  if (el.type === 'shape') {
    return <div style={{ width: '100%', height: '100%', borderRadius: 6, background: el.color || '#E2E8F0', border: `2px solid ${el.borderColor || '#94A3B8'}` }} />
  }
  return null
}

// ═══════════════════════════════
// MINI PREVIEW
// ═══════════════════════════════
function MiniPreview({ layout, task, dept, profiles }) {
  const ref = useRef(null)
  const [s, setS] = useState(0.15)
  useEffect(() => {
    if (!ref.current) return
    const parent = ref.current.parentElement
    if (parent) setS(parent.clientWidth / CW)
  }, [layout])
  if (!layout?.elements) return null
  return (
    <div ref={ref} style={{ width: CW, height: CH, transform: `scale(${s})`, transformOrigin: '0 0', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
      {/* Shapes first (z-index 0) */}
      {layout.elements.filter(e => e.type === 'shape').map(el => (
        <div key={el.id} style={{ position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h }}>
          <ElementRender el={el} task={task} profiles={profiles} scale={1} />
        </div>
      ))}
      {/* Arrows */}
      {layout.elements.filter(e => e.type === 'arrow').map(el => (
        <svg key={el.id} style={{ position: 'absolute', inset: 0, width: CW, height: CH, pointerEvents: 'none' }}>
          <defs><marker id={`mini_${el.id}`} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill={el.color || '#1a1a1a'} /></marker></defs>
          <line x1={el.x1||0} y1={el.y1||0} x2={el.x2||0} y2={el.y2||0} stroke={el.color||'#1a1a1a'} strokeWidth={el.strokeWidth||3} markerEnd={`url(#mini_${el.id})`} />
        </svg>
      ))}
      {/* Other elements */}
      {layout.elements.filter(e => e.type !== 'shape' && e.type !== 'arrow').map(el => (
        <div key={el.id} style={{ position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h, overflow: 'hidden' }}>
          <ElementRender el={el} task={task} profiles={profiles} scale={1} />
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════
// PROPERTIES PANEL
// ═══════════════════════════════
function PropertiesPanel({ el, onUpdate, layout, onBgChange }) {
  if (!el) return null
  const names = { title: 'Title', description: 'Description', badge: 'Dept', student: 'Student', image: 'Image', audio: 'Audio', custom_text: 'Text', arrow: 'Arrow', shape: 'Shape' }
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 10, textTransform: 'uppercase' }}>{names[el.type] || el.type}</div>
      <label style={propLabel}>X</label><input type="number" value={el.x} onChange={e => onUpdate({ x: +e.target.value })} style={propInput} />
      <label style={propLabel}>Y</label><input type="number" value={el.y} onChange={e => onUpdate({ y: +e.target.value })} style={propInput} />
      <label style={propLabel}>W</label><input type="number" value={el.w} onChange={e => onUpdate({ w: Math.max(20, +e.target.value) })} style={propInput} />
      <label style={propLabel}>H</label><input type="number" value={el.h} onChange={e => onUpdate({ h: Math.max(20, +e.target.value) })} style={propInput} />
      {(el.type === 'title' || el.type === 'description' || el.type === 'custom_text') && (
        <>
          <label style={propLabel}>Font</label>
          <input type="range" min={8} max={48} value={el.fontSize || 14} onChange={e => onUpdate({ fontSize: +e.target.value })} style={{ width: '100%', accentColor: ACCENT }} />
          <div style={{ fontSize: 10, color: '#94A3B8', textAlign: 'right' }}>{el.fontSize || 14}px</div>
          <label style={propLabel}>Align</label>
          <div style={{ display: 'flex', gap: 2 }}>
            {['left', 'center', 'right'].map(a => (
              <button key={a} onClick={() => onUpdate({ textAlign: a })} style={{
                flex: 1, padding: '4px 0', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                border: (el.textAlign || 'left') === a ? `2px solid ${ACCENT}` : '1px solid #E2E8F0',
                background: (el.textAlign || 'left') === a ? ACCENT + '15' : '#fff',
                color: (el.textAlign || 'left') === a ? ACCENT : '#64748B', fontWeight: 600,
              }}>{a === 'left' ? '⫷' : a === 'center' ? '⫿' : '⫸'}</button>
            ))}
          </div>
        </>
      )}
      {(el.type === 'custom_text' || el.type === 'arrow' || el.type === 'shape') && (
        <><label style={propLabel}>Color</label><input type="color" value={el.color || '#1a1a1a'} onChange={e => onUpdate({ color: e.target.value })} style={colorInput} /></>
      )}
      {el.type === 'shape' && <><label style={propLabel}>Border</label><input type="color" value={el.borderColor || '#94A3B8'} onChange={e => onUpdate({ borderColor: e.target.value })} style={colorInput} /></>}
      {el.type === 'arrow' && <><label style={propLabel}>Thickness</label><input type="range" min={1} max={8} value={el.strokeWidth || 3} onChange={e => onUpdate({ strokeWidth: +e.target.value })} style={{ width: '100%', accentColor: ACCENT }} /></>}
      <div style={{ marginTop: 12 }}><label style={propLabel}>Background</label><input type="color" value={layout.bg || '#FFF'} onChange={e => onBgChange(e.target.value)} style={colorInput} /></div>
    </div>
  )
}

const propLabel = { fontSize: 9, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', display: 'block', marginTop: 8, marginBottom: 2 }
const propInput = { width: '100%', padding: '4px 6px', borderRadius: 5, border: '1px solid #E2E8F0', fontSize: 11, outline: 'none' }
const colorInput = { width: '100%', height: 26, border: '1px solid #E2E8F0', borderRadius: 5, cursor: 'pointer' }
const presBtn = { background: 'none', border: 'none', color: '#fff', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }
const tbBtn = { background: '#fff', border: '1px solid #E2E8F0', borderRadius: 6, padding: '5px 10px', fontSize: 12, cursor: 'pointer', color: '#475569', fontWeight: 600 }
const resizeHandle = { position: 'absolute', width: 10, height: 10, background: ACCENT, borderRadius: 2, zIndex: 200 }
