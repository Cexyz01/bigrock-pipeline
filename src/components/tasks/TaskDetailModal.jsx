import { useState, useEffect, useRef } from 'react'
import { DEPTS, isStaff, isSuperAdmin, displayRole, isAudioUrl, isVideoUrl, hasPermission } from '../../lib/constants'
import { getWipUpdates, getWipComments, deleteWipComment, toggleWipStoryboardPin } from '../../lib/supabase'
import useIsMobile from '../../hooks/useIsMobile'
import Btn from '../ui/Btn'
import Av from '../ui/Av'
import StatusBadge from '../ui/StatusBadge'
import Input from '../ui/Input'
import DateInput from '../ui/DateInput'
import Select from '../ui/Select'
import ImageLightbox from '../ui/ImageLightbox'
import { IconX, IconImage, IconSend, IconCheck, IconTrash, IconStar, IconDownload } from '../ui/Icons'
import AssigneePicker from './AssigneePicker'
import { cld } from '../../lib/cld'
import { downloadMedia } from '../../lib/downloadFile'
import Img from '../ui/Img'
import AnnotatedImage from '../ui/AnnotatedImage'

const MAX_IMAGES = 4
const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB
const MAX_AUDIO_SIZE = 10 * 1024 * 1024 // 10MB for audio
const MAX_VIDEO_SIZE = 100 * 1024 * 1024 // 100MB for video

export default function TaskDetailModal({
  task, user, staff, profiles, students: studentsProp = null, shots = [], projectStartDate = null,
  onClose, onUpdate, onSetAssignees, onDelete, onReject, onAddWipComment,
  onCreateWipUpdate, onDeleteWipUpdate, onCommitForReview, onMarkWipViewed,
  addToast, requestConfirm,
  scrollToWipId = null,
}) {
  const isMobile = useIsMobile()
  const [mobileTab, setMobileTab] = useState('info') // mobile: info | wip
  // Staff inline edit fields — auto-save on blur, no toggle
  const [editTitle, setEditTitle] = useState(task.title || '')
  const [editDesc, setEditDesc] = useState(task.description || '')
  const [editDept, setEditDept] = useState(task.department || '')
  const [editShotId, setEditShotId] = useState(task.shot_id || '')
  const [editStartDate, setEditStartDate] = useState(task.start_date || projectStartDate || '')
  const [editDuration, setEditDuration] = useState(task.duration_days || 1)
  const [editRequired, setEditRequired] = useState(task.required_assignees || 1)
  const [savedFlash, setSavedFlash] = useState(false)
  // Track initial date-field value so blurring without a user edit doesn't auto-persist
  // the project default (only persist if user actually changes it).
  const initialStartRef = useRef(task.start_date || projectStartDate || '')
  // Reset edit fields if task identity changes
  useEffect(() => {
    setEditTitle(task.title || '')
    setEditDesc(task.description || '')
    setEditDept(task.department || '')
    setEditShotId(task.shot_id || '')
    const initStart = task.start_date || projectStartDate || ''
    setEditStartDate(initStart)
    initialStartRef.current = initStart
    setEditDuration(task.duration_days || 1)
    setEditRequired(task.required_assignees || 1)
  }, [task.id, projectStartDate])

  const flashSaved = () => {
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1200)
  }
  const saveField = async (field, value) => {
    await onUpdate(task.id, { [field]: value })
    flashSaved()
  }
  const blurTitle = () => {
    const next = editTitle.trim()
    if (!next) { setEditTitle(task.title || ''); return }
    if (next !== task.title) saveField('title', next)
  }
  const blurDesc = () => {
    const next = editDesc.trim() || null
    if (next !== (task.description || null)) saveField('description', next)
  }
  const changeDept = (val) => {
    setEditDept(val)
    if (val !== task.department) saveField('department', val || null)
  }
  const changeShot = (val) => {
    const next = val || null
    setEditShotId(val || '')
    if (next !== (task.shot_id || null)) {
      // Moving to a shot detaches the task from any asset so it can't belong to both.
      onUpdate(task.id, { shot_id: next, ...(next ? { asset_id: null } : {}) }).then(flashSaved)
    }
  }
  const blurStartDate = () => {
    // Don't auto-persist the project-default fallback: only save if the user actually
    // typed something different from what we initially seeded the input with.
    if (editStartDate === initialStartRef.current) return
    const next = editStartDate || null
    if (next !== (task.start_date || null)) saveField('start_date', next)
  }
  const blurDuration = () => {
    const next = Math.max(1, parseInt(editDuration, 10) || 1)
    setEditDuration(next)
    if (next !== (task.duration_days || 1)) saveField('duration_days', next)
  }
  const blurRequired = () => {
    const next = Math.max(1, parseInt(editRequired, 10) || 1)
    setEditRequired(next)
    if (next !== (task.required_assignees || 1)) saveField('required_assignees', next)
  }
  const [wipUpdates, setWipUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  // WIP publish form (student)
  const [wipFiles, setWipFiles] = useState([])
  const [wipPreviews, setWipPreviews] = useState([])
  const [wipNote, setWipNote] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [wipDragOver, setWipDragOver] = useState(false)
  // Image lightbox
  const [lightboxUrl, setLightboxUrl] = useState(null)
  const [lightboxImages, setLightboxImages] = useState(null)
  // Per-WIP comments
  const [wipComments, setWipComments] = useState({})         // { [wipUpdateId]: [comment, ...] }
  const [wipCommentInputs, setWipCommentInputs] = useState({}) // { [wipUpdateId]: string }

  const fileInputRef = useRef(null)
  // Per-WIP DOM refs so we can scroll to a specific update when deep-linked
  // from the Activity tracker (click a WIP card → open task and jump to it).
  const wipRefs = useRef({})
  const [highlightWipId, setHighlightWipId] = useState(null)
  useEffect(() => {
    if (loading || !scrollToWipId) return
    // Mobile uses tabs; ensure the WIP tab is active so the row mounts
    if (isMobile && mobileTab !== 'wip') { setMobileTab('wip'); return }
    const el = wipRefs.current[scrollToWipId]
    if (!el) return
    const id = scrollToWipId
    setHighlightWipId(id)
    const t = setTimeout(() => {
      try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }) } catch { el.scrollIntoView() }
    }, 50)
    const t2 = setTimeout(() => setHighlightWipId(curr => curr === id ? null : curr), 2200)
    return () => { clearTimeout(t); clearTimeout(t2) }
  }, [loading, scrollToWipId, isMobile, mobileTab, wipUpdates])
  const dept = DEPTS.find(d => d.id === task.department)
  const assignees = task.assignees || []
  const isOwner = assignees.some(a => a.user.id === user.id)

  // Load WIP updates + per-WIP comments
  useEffect(() => {
    getWipUpdates(task.id).then(async (w) => {
      setWipUpdates(w)
      // Batch-fetch all WIP comments
      const wipIds = w.map(u => u.id)
      const allComments = await getWipComments(wipIds)
      const grouped = {}
      for (const c of allComments) {
        if (!grouped[c.wip_update_id]) grouped[c.wip_update_id] = []
        grouped[c.wip_update_id].push(c)
      }
      setWipComments(grouped)
      setLoading(false)
    })
    // Staff: mark WIP as viewed when opening
    if (staff && onMarkWipViewed) onMarkWipViewed(task.id)
  }, [task.id])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => wipPreviews.forEach(url => URL.revokeObjectURL(url))
  }, [])

  // ── Handlers ──

  const handleAction = async (action, updates, successMsg) => {
    setActionLoading(action)
    await onUpdate(task.id, updates)
    if (addToast) addToast(successMsg, 'success')
    setActionLoading(null)
    onClose()
  }

  const [showRejectComment, setShowRejectComment] = useState(false)
  const [rejectComment, setRejectComment] = useState('')

  const handleReject = async () => {
    if (!showRejectComment) {
      setShowRejectComment(true)
      return
    }
    setActionLoading('reject')
    await onReject(task.id, rejectComment.trim())
    setActionLoading(null)
    onClose()
  }

  const handleDelete = () => {
    requestConfirm(`Delete task "${task.title}"?`, () => { onDelete(task.id); onClose() })
  }

  const toggleAssignee = async (userId) => {
    const currentIds = assignees.map(a => a.user.id)
    const next = currentIds.includes(userId)
      ? currentIds.filter(x => x !== userId)
      : [...currentIds, userId]
    await onSetAssignees?.(task.id, next)
    if (addToast) addToast('Assignment updated', 'success')
  }

  // WIP file management — shared core used by the picker, paste (Ctrl+V) and
  // drag-and-drop. Enforces MAX_IMAGES count + per-type size limits.
  const addWipFiles = (fileList) => {
    const selected = Array.from(fileList || [])
    if (!selected.length) return
    const available = MAX_IMAGES - wipFiles.length
    if (available <= 0) {
      if (addToast) addToast(`Maximum ${MAX_IMAGES} images`, 'danger')
      return
    }
    const toAdd = selected.slice(0, available)
    const getMaxSize = (f) => {
      const t = f.type || ''
      if (t.startsWith('video/')) return MAX_VIDEO_SIZE
      if (t.startsWith('audio/')) return MAX_AUDIO_SIZE
      return MAX_FILE_SIZE
    }
    const oversized = toAdd.filter(f => f.size > getMaxSize(f))
    if (oversized.length > 0) {
      if (addToast) addToast(`${oversized.length} file(s) too large`, 'danger')
    }
    const valid = toAdd.filter(f => f.size <= getMaxSize(f))
    if (valid.length === 0) return
    const newPreviews = valid.map(f => URL.createObjectURL(f))
    setWipFiles(prev => [...prev, ...valid])
    setWipPreviews(prev => [...prev, ...newPreviews])
  }

  const handleFilesSelect = (e) => {
    addWipFiles(e.target.files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Ctrl+V of a clipboard image/file (e.g. a screenshot) → add it as a WIP file.
  // Pasted images usually have a generic/blank name, so we give them one.
  const handleWipPaste = (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    const files = []
    for (const it of items) {
      if (it.kind !== 'file') continue
      const f = it.getAsFile()
      if (!f) continue
      if (!f.name || f.name === 'image.png' || f.name === 'blob') {
        const ext = (f.type.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '')
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
        files.push(new File([f], `incolla-${stamp}.${ext}`, { type: f.type }))
      } else {
        files.push(f)
      }
    }
    if (files.length) { e.preventDefault(); addWipFiles(files) }
  }

  // Drag-and-drop onto the WIP composer. Depth counter avoids overlay flicker
  // when the cursor moves over child elements.
  const wipDragDepth = useRef(0)
  const dragHasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files')
  const handleWipDragEnter = (e) => {
    if (!dragHasFiles(e)) return
    e.preventDefault(); wipDragDepth.current += 1; setWipDragOver(true)
  }
  const handleWipDragOver = (e) => {
    if (!dragHasFiles(e)) return
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy'
  }
  const handleWipDragLeave = () => {
    wipDragDepth.current = Math.max(0, wipDragDepth.current - 1)
    if (wipDragDepth.current === 0) setWipDragOver(false)
  }
  const handleWipDrop = (e) => {
    e.preventDefault(); wipDragDepth.current = 0; setWipDragOver(false)
    if (e.dataTransfer?.files?.length) addWipFiles(e.dataTransfer.files)
  }

  const handleRemoveFile = (index) => {
    URL.revokeObjectURL(wipPreviews[index])
    setWipFiles(prev => prev.filter((_, i) => i !== index))
    setWipPreviews(prev => prev.filter((_, i) => i !== index))
  }

  // Student publishes a WIP update
  const handlePublishWip = async () => {
    if (wipFiles.length === 0 && !wipNote.trim()) {
      if (addToast) addToast('Add at least one image or note', 'danger')
      return
    }
    console.log('[WIP] Publishing with', wipFiles.length, 'files:', wipFiles.map(f => `${f.name} (${f.size}b)`))
    setPublishing(true)
    const result = await onCreateWipUpdate(task.id, wipNote.trim(), wipFiles)
    if (result) {
      // Refresh WIP updates + comments
      const updated = await getWipUpdates(task.id)
      setWipUpdates(updated)
      const wipIds = updated.map(u => u.id)
      const allComments = await getWipComments(wipIds)
      const grouped = {}
      for (const c of allComments) {
        if (!grouped[c.wip_update_id]) grouped[c.wip_update_id] = []
        grouped[c.wip_update_id].push(c)
      }
      setWipComments(grouped)
      // Reset form
      wipPreviews.forEach(url => URL.revokeObjectURL(url))
      setWipFiles([])
      setWipPreviews([])
      setWipNote('')
    }
    setPublishing(false)
  }

  // Staff picks which WIPs to send to the review carousel. Default empty so the
  // "Submit for Review" button stays disabled until at least one is ticked.
  const [selectedReviewIds, setSelectedReviewIds] = useState(() => new Set())
  // Reset selection when the task identity changes (modal re-used for next task).
  useEffect(() => { setSelectedReviewIds(new Set()) }, [task.id])
  const toggleReviewSelect = (wipId) => {
    setSelectedReviewIds(prev => {
      const next = new Set(prev)
      if (next.has(wipId)) next.delete(wipId)
      else next.add(wipId)
      return next
    })
  }
  const canSelectForReview = staff && task.status === 'wip'

  // Staff commits for review
  const handleCommitReview = async () => {
    if (selectedReviewIds.size === 0) return
    setActionLoading('commit')
    await onCommitForReview(task.id, Array.from(selectedReviewIds))
    setActionLoading(null)
    onClose()
  }

  // Per-WIP comment handler (staff only)
  const handleWipComment = async (wipUpdateId) => {
    const body = (wipCommentInputs[wipUpdateId] || '').trim()
    if (!body) return
    const { data, error } = await onAddWipComment(wipUpdateId, task.id, user.id, body)
    if (error || !data) {
      // Surface failures so the user knows nothing was saved (previously the
      // insert was being silently rejected by RLS and the field just cleared).
      addToast?.(`Errore nel salvataggio del feedback: ${error?.message || 'sconosciuto'}`, 'danger')
      return
    }
    setWipComments(prev => ({
      ...prev,
      [wipUpdateId]: [...(prev[wipUpdateId] || []), data],
    }))
    setWipCommentInputs(prev => ({ ...prev, [wipUpdateId]: '' }))
  }

  // Prof+ (anyone with access_review) can remove a single WIP update +
  // purge its R2 assets. Server-side RLS on task_wip_updates still
  // enforces the same staff check.
  const canDeleteWip = !!onDeleteWipUpdate && hasPermission(user, 'access_review')

  // Per-comment delete: comment author always, or any reviewer (prof+).
  // RLS (migration 062) mirrors this — author OR non-studente.
  const canDeleteWipComment = (comment) => {
    if (!comment) return false
    if (comment.author_id === user?.id || comment.author?.id === user?.id) return true
    return hasPermission(user, 'access_review')
  }
  const handleDeleteWipComment = (wipUpdateId, commentId) => {
    requestConfirm(
      'Eliminare questo feedback?',
      async () => {
        const { error } = await deleteWipComment(commentId)
        if (error) {
          addToast?.(`Errore: ${error.message || 'eliminazione non riuscita'}`, 'danger')
          return
        }
        setWipComments(prev => ({
          ...prev,
          [wipUpdateId]: (prev[wipUpdateId] || []).filter(c => c.id !== commentId),
        }))
      },
    )
  }
  // Storyboard pin toggle — only meaningful on approved tasks.
  // RLS lets the WIP author OR any staff change it; we mirror that here so
  // students don't see a checkbox they can't use on someone else's image.
  const canPinForWip = (update) => {
    if (task.status !== 'approved') return false
    if (!update) return false
    return update.user_id === user?.id || isStaff(user)
  }
  const handleTogglePin = async (update, imgUrl) => {
    const current = Array.isArray(update.pinned_storyboard_urls) ? update.pinned_storyboard_urls : []
    const isPinned = current.includes(imgUrl)
    const next = isPinned ? current.filter(u => u !== imgUrl) : [...current, imgUrl]
    // Optimistic update
    setWipUpdates(prev => prev.map(u => u.id === update.id ? { ...u, pinned_storyboard_urls: next } : u))
    const { error } = await toggleWipStoryboardPin(update.id, imgUrl, !isPinned)
    if (error) {
      // Revert
      setWipUpdates(prev => prev.map(u => u.id === update.id ? { ...u, pinned_storyboard_urls: current } : u))
      addToast?.(`Errore: ${error.message || 'aggiornamento non riuscito'}`, 'danger')
    } else {
      addToast?.(isPinned ? 'Rimossa dalla Storyboard' : 'Aggiunta alla Storyboard', 'success')
    }
  }

  const handleDeleteWip = (wipUpdateId) => {
    requestConfirm(
      'Eliminare questo WIP? I file caricati verranno cancellati definitivamente.',
      async () => {
        const result = await onDeleteWipUpdate(wipUpdateId)
        if (result?.ok) {
          setWipUpdates(prev => prev.filter(u => u.id !== wipUpdateId))
          setWipComments(prev => {
            const next = { ...prev }
            delete next[wipUpdateId]
            return next
          })
        }
      },
    )
  }

  // Prefer the explicit `students` prop (project-filtered + project_role enriched)
  // over deriving from profiles, which would show ALL students globally.
  const students = studentsProp ?? (profiles ? profiles.filter(p => p.role_slug === 'studente') : [])
  const hasWipUpdates = wipUpdates.length > 0

  // Shot selector options (staff "move to another shot"). Sorted like CreateTaskModal,
  // with a leading detach option so a task can be unlinked from its current shot.
  const truncate = (s, n = 40) => !s ? '' : (s.length > n ? s.slice(0, n - 1) + '…' : s)
  const shotOptions = [
    { value: '', label: '— Nessuno —' },
    ...[...(shots || [])]
      .sort((a, b) =>
        (a.sequence || '').localeCompare(b.sequence || '') ||
        ((a.sort_order ?? 0) - (b.sort_order ?? 0)) ||
        (a.code || '').localeCompare(b.code || ''))
      .map(s => {
        const desc = s.description ? truncate(s.description) : s.sequence
        return { value: s.id, label: desc ? `${s.code}  ·  ${desc}` : s.code }
      }),
  ]

  // ── Shared content renderers ──
  // Visual hierarchy:
  //   Section headers   → 10px / 700 / uppercase / letter-spaced gray
  //   Field labels      → 11px / 600 gray
  //   Inputs            → 13px regular
  //   Container chips   → small pills in the section header line
  const sectionHeader = { fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }
  const fieldLabel = { fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }
  const compactInput = { width: '100%', fontSize: 13, color: '#1a1a1a', border: '1px solid #E2E8F0', borderRadius: 8, padding: '8px 10px', outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' }

  const renderInfoContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* PIANIFICAZIONE — pinned at top */}
      {staff && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={sectionHeader}>Pianificazione</span>
            {savedFlash && <span style={{ fontSize: 10, color: '#10B981', fontWeight: 700 }}>✓ Salvato</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1.4 }}>
              <span style={fieldLabel}>Inizio</span>
              <DateInput value={editStartDate}
                onChange={v => { setEditStartDate(v); if (v !== (task.start_date || '')) saveField('start_date', v || null) }}
                compact placeholder="—" />
            </div>
            <div style={{ flex: 1 }}>
              <span style={fieldLabel}>Durata (g)</span>
              <input type="number" min={1} value={editDuration}
                onChange={e => setEditDuration(e.target.value)} onBlur={blurDuration}
                style={compactInput} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={fieldLabel}>Richiesti</span>
              <input type="number" min={1} value={editRequired}
                onChange={e => setEditRequired(e.target.value)} onBlur={blurRequired}
                style={compactInput} />
            </div>
          </div>
        </div>
      )}

      {/* DETTAGLI */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
          <span style={sectionHeader}>Dettagli</span>
          {/* Container chip in header for context */}
          {task.asset && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', background: 'rgba(167,139,250,0.12)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(167,139,250,0.35)' }}>ASSET · {task.asset.name}</span>
          )}
          {task.shot && (
            <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', background: '#F1F5F9', padding: '3px 8px', borderRadius: 6, border: '1px solid #E2E8F0' }}>SHOT · {task.shot.code}</span>
          )}
        </div>
        {staff ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <span style={fieldLabel}>Titolo</span>
              <Input value={editTitle} onChange={setEditTitle} onBlur={blurTitle} placeholder="Task title"
                style={{ fontSize: 14, fontWeight: 600 }} />
            </div>
            <div>
              <span style={fieldLabel}>Dipartimento</span>
              <Select value={editDept} onChange={changeDept} options={DEPTS.map(d => ({ value: d.id, label: d.label }))} placeholder="Select department" style={{ fontSize: 13 }} />
            </div>
            {!task.asset_id && (
              <div>
                <span style={fieldLabel}>Shot</span>
                <Select value={editShotId} onChange={changeShot} options={shotOptions} placeholder="Nessuno shot" style={{ fontSize: 13 }} />
              </div>
            )}
            <div>
              <span style={fieldLabel}>Descrizione</span>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} onBlur={blurDesc} placeholder="Descrizione del task..." rows={3}
                style={{ ...compactInput, resize: 'vertical', lineHeight: 1.5, minHeight: 64 }} />
            </div>
          </div>
        ) : task.description ? (
          <div>
            <span style={fieldLabel}>Descrizione</span>
            <p style={{ fontSize: 13, color: '#475569', lineHeight: 1.55, margin: 0, padding: '10px 12px', background: '#F8FAFC', borderRadius: 8 }}>{task.description}</p>
          </div>
        ) : null}
      </div>

      {/* ASSEGNATARI */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={sectionHeader}>Assegnatari</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>{assignees.length}</span>
        </div>
        {assignees.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {assignees.map(a => (
              <div key={a.user.id} style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#F1F5F9', padding: '2px 8px 2px 2px', borderRadius: 999, border: '1px solid #E2E8F0' }}>
                <Av name={a.user.full_name} size={18} url={a.user.avatar_url} />
                <span style={{ fontSize: 11, color: '#1a1a1a', fontWeight: 500 }}>{a.user.full_name}</span>
              </div>
            ))}
          </div>
        )}
        {staff && (
          <AssigneePicker
            students={students}
            selectedIds={assignees.map(a => a.user.id)}
            onToggle={toggleAssignee}
            selectedDept={task.department}
            compact
          />
        )}
      </div>
      {staff && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid #E8ECF1' }}>
          <span style={{ ...sectionHeader, marginBottom: 4 }}>Azioni</span>
          {task.status === 'todo' && (() => {
            // Grey-style + confirm prompt when today is before the planned start_date.
            let tooEarly = false
            let plannedLabel = ''
            if (task.start_date) {
              const today = new Date(); today.setHours(0, 0, 0, 0)
              const [y, m, d] = task.start_date.split('-').map(Number)
              const planned = new Date(y, m - 1, d)
              if (planned > today) {
                tooEarly = true
                plannedLabel = planned.toLocaleDateString('it', { day: 'numeric', month: 'long' })
              }
            }
            const startNow = () => handleAction('start', { status: 'wip' }, 'Task started!')
            const onClick = () => {
              if (tooEarly && requestConfirm) {
                requestConfirm(`Sei sicuro? Non è ancora il giorno previsto per l'inizio (${plannedLabel}). Procedere comunque?`, startNow)
                return
              }
              startNow()
            }
            return (
              <Btn variant={tooEarly ? 'info' : 'primary'} loading={actionLoading === 'start'} onClick={onClick}
                title={tooEarly ? 'Non è ancora il giorno previsto' : undefined}
                style={{ width: '100%', justifyContent: 'center', ...(tooEarly ? { background: '#CBD5E1', color: '#475569', borderColor: '#CBD5E1' } : {}) }}>
                Start
              </Btn>
            )
          })()}
          {task.status === 'wip' && hasWipUpdates && (
            <Btn
              variant="primary"
              loading={actionLoading === 'commit'}
              onClick={handleCommitReview}
              disabled={selectedReviewIds.size === 0}
              title={selectedReviewIds.size === 0 ? 'Seleziona almeno un WIP da inviare in review' : undefined}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Submit for Review{selectedReviewIds.size > 0 ? ` (${selectedReviewIds.size})` : ''}
            </Btn>
          )}
          {task.status === 'wip' && (
            <Btn variant="info" loading={actionLoading === 'reset-todo'}
              onClick={() => requestConfirm('Riportare questo task in TO DO?', async () => {
                setActionLoading('reset-todo')
                await onUpdate(task.id, { status: 'todo' })
                if (addToast) addToast('Task riportato in TO DO', 'success')
                setActionLoading(null)
              })}
              style={{ width: '100%', justifyContent: 'center' }}>
              ↩ Riporta in TO DO
            </Btn>
          )}
          {task.status === 'review' && (
            <>
              {/* Hide Approve once the reject flow is active so the staff
                  can't accidentally approve after typing a revision comment. */}
              {!showRejectComment && (
                <Btn variant="success" loading={actionLoading === 'approve'} onClick={() => handleAction('approve', { status: 'approved' }, 'Task approved!')} style={{ width: '100%', justifyContent: 'center' }}>Approve</Btn>
              )}
              <Btn variant="info" loading={actionLoading === 'reject'} onClick={handleReject} style={{ width: '100%', justifyContent: 'center' }}>
                {showRejectComment ? 'Invia' : 'Request Changes'}
              </Btn>
              {showRejectComment && (
                <div style={{ width: '100%' }}>
                  <textarea
                    value={rejectComment}
                    onChange={e => setRejectComment(e.target.value)}
                    placeholder="Commento per lo studente..."
                    autoFocus
                    style={{ width: '100%', minHeight: 70, borderRadius: 8, border: '1px solid #CBD5E1', padding: 10, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                  <button onClick={() => { setShowRejectComment(false); setRejectComment('') }}
                    style={{ marginTop: 4, fontSize: 11, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Annulla
                  </button>
                </div>
              )}
            </>
          )}
          {task.status === 'approved' && (
            <Btn variant="info" loading={actionLoading === 'reopen'}
              onClick={() => requestConfirm('Riportare questo task in WIP? Lo studente potrà ricaricare nuovi WIP e dovrà essere riapprovato.', async () => {
                setActionLoading('reopen')
                await onUpdate(task.id, { status: 'wip' })
                if (addToast) addToast('Task riportato in WIP', 'success')
                setActionLoading(null)
                onClose()
              })}
              style={{ width: '100%', justifyContent: 'center' }}>
              ↩ Riporta in WIP
            </Btn>
          )}
          {task.status !== 'approved' && (
            <Btn variant="success" loading={actionLoading === 'force-done'}
              onClick={() => requestConfirm(
                'Sei sicuro di voler saltare la review e spostare questo task direttamente in DONE?',
                async () => {
                  setActionLoading('force-done')
                  await onUpdate(task.id, { status: 'approved' })
                  if (addToast) addToast('Task spostato in Done', 'success')
                  setActionLoading(null)
                  onClose()
                }
              )}
              style={{ width: '100%', justifyContent: 'center', background: '#94A3B8', borderColor: '#94A3B8' }}
              title="Salta la review e segna come completato">
              ⇥ Move to Done
            </Btn>
          )}
          <Btn variant="danger" onClick={handleDelete} style={{ width: '100%', justifyContent: 'center' }}>Delete</Btn>
        </div>
      )}
    </div>
  )

  // ── Per-WIP inline comments renderer ──
  const renderWipCardComments = (updateId) => {
    const cmts = wipComments[updateId] || []
    const hasContent = cmts.length > 0 || staff
    if (!hasContent) return null

    return (
      <div style={{ marginTop: 10, borderTop: '1px solid #E8ECF1', paddingTop: 10 }}>
        {/* Existing comments */}
        {cmts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: staff ? 10 : 0 }}>
            {cmts.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Av name={c.author?.full_name} size={20} url={c.author?.avatar_url} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a' }}>{c.author?.full_name}</span>
                    {c.author?.role !== 'studente' && (
                      <span style={{ fontSize: 9, color: '#F28C28', background: 'rgba(242,140,40,0.08)', padding: '1px 5px', borderRadius: 4 }}>{displayRole(c.author?.role)}</span>
                    )}
                    <span style={{ fontSize: 10, color: '#B0B8C4' }}>
                      {new Date(c.created_at).toLocaleDateString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.4, marginTop: 2 }}>{c.body}</div>
                </div>
                {canDeleteWipComment(c) && (
                  <button
                    onClick={() => handleDeleteWipComment(updateId, c.id)}
                    title="Elimina feedback"
                    style={{
                      background: 'transparent', border: 'none', color: '#B0B8C4',
                      cursor: 'pointer', padding: 2, fontSize: 14, lineHeight: 1,
                      flexShrink: 0,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                    onMouseLeave={e => (e.currentTarget.style.color = '#B0B8C4')}
                  >×</button>
                )}
              </div>
            ))}
          </div>
        )}
        {/* Staff comment input */}
        {staff && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Input
              value={wipCommentInputs[updateId] || ''}
              onChange={v => setWipCommentInputs(prev => ({ ...prev, [updateId]: v }))}
              placeholder="Add feedback..."
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleWipComment(updateId))}
              style={{ flex: 1, fontSize: 11, padding: '7px 10px' }}
            />
            <Btn variant="primary" onClick={() => handleWipComment(updateId)} style={{ padding: '7px 10px' }}>
              <IconSend size={12} />
            </Btn>
          </div>
        )}
      </div>
    )
  }

  const renderWipContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? 0 : 20 }}>
        {/* Pinned revision feedback — surfaced when staff sent the task back to WIP
            with a comment. Cleared automatically when status moves to review/approved. */}
        {task.revision_comment && (
          <div style={{
            marginBottom: 16, padding: '14px 16px', borderRadius: 14,
            background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)',
            border: '1.5px solid #F59E0B', boxShadow: '0 2px 8px rgba(245,158,11,0.18)',
            display: 'flex', gap: 12, alignItems: 'flex-start',
          }}>
            <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>📌</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                Revisione richiesta
                {task.revision_comment_at && (
                  <span style={{ fontWeight: 500, opacity: 0.8, marginLeft: 8, textTransform: 'none', letterSpacing: 0 }}>
                    · {new Date(task.revision_comment_at).toLocaleDateString('it', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 14, color: '#78350F', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {task.revision_comment}
              </div>
            </div>
          </div>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', color: '#94A3B8', paddingTop: 40 }}>Loading...</div>
        ) : wipUpdates.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}><IconImage size={48} color="#94A3B8" /></div>
            <div style={{ fontSize: 14, color: '#94A3B8', fontWeight: 500 }}>No WIP updates</div>
            <div style={{ fontSize: 12, color: '#B0B8C4', marginTop: 4 }}>{isOwner && task.status === 'wip' ? 'Publish your first update below' : 'WIP updates will appear here'}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {wipUpdates.map((update, idx) => (
              <div
                key={update.id}
                ref={el => { if (el) wipRefs.current[update.id] = el; else delete wipRefs.current[update.id] }}
                style={{
                  padding: isMobile ? 12 : 16, borderRadius: 14,
                  background: highlightWipId === update.id ? '#FFF7ED' : '#F8FAFC',
                  border: highlightWipId === update.id
                    ? '2px solid #F28C28'
                    : (idx === 0 ? '1px solid #F28C2820' : '1px solid #E8ECF1'),
                  boxShadow: highlightWipId === update.id ? '0 0 0 4px rgba(242,140,40,0.18)' : 'none',
                  transition: 'background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  {canSelectForReview && (
                    <label
                      title="Includi in review"
                      onClick={e => e.stopPropagation()}
                      style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedReviewIds.has(update.id)}
                        onChange={() => toggleReviewSelect(update.id)}
                        style={{ width: 18, height: 18, accentColor: '#F28C28', cursor: 'pointer', margin: 0 }}
                      />
                    </label>
                  )}
                  <Av name={update.author?.full_name} size={26} url={update.author?.avatar_url} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{update.author?.full_name}</span>
                    {idx === 0 && <span style={{ fontSize: 10, fontWeight: 600, color: '#F28C28', background: 'rgba(242,140,40,0.08)', padding: '2px 8px', borderRadius: 6, marginLeft: 8 }}>Latest</span>}
                  </div>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(update.created_at).toLocaleDateString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  {canDeleteWip && (
                    <button
                      onClick={() => handleDeleteWip(update.id)}
                      title="Elimina WIP (rimuove anche i file da R2)"
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: '#94A3B8', padding: 4, borderRadius: 6,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEE2E2' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8'; e.currentTarget.style.background = 'transparent' }}
                    >
                      <IconTrash size={14} />
                    </button>
                  )}
                </div>
                {/* WIP note — displayed as "✅ Done:" */}
                {update.note && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', lineHeight: 1.5, margin: '0 0 10px' }}>
                    <span style={{ fontWeight: 600, color: '#059669', display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0 }}><IconCheck size={14} color="#059669" /> Done:</span>
                    <span style={{ marginTop: -1 }}>{update.note}</span>
                  </div>
                )}
                {update.images && update.images.length > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 6 }}>
                    {update.images.map((imgUrl, imgIdx) => {
                      if (isAudioUrl(imgUrl)) {
                        return (
                          <div key={imgIdx} style={{ gridColumn: 'span 2', borderRadius: 8, border: '1px solid #E2E8F0', padding: 8, background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 20 }}>&#9835;</span>
                            <audio controls src={imgUrl} style={{ width: '100%', height: 36 }} preload="metadata" />
                          </div>
                        )
                      }
                      if (isVideoUrl(imgUrl)) {
                        return (
                          <div key={imgIdx} style={{ gridColumn: 'span 2', borderRadius: 8, border: '1px solid #E2E8F0', background: '#000', overflow: 'hidden' }}>
                            <video controls src={imgUrl} style={{ width: '100%', display: 'block', maxHeight: 260 }} preload="metadata" />
                          </div>
                        )
                      }
                      const pinnedList = Array.isArray(update.pinned_storyboard_urls) ? update.pinned_storyboard_urls : []
                      const isPinned = pinnedList.includes(imgUrl)
                      const canPin = canPinForWip(update)
                      // Visible on approved task when user can toggle, or always when pinned (so others see the badge).
                      const showOverlay = (task.status === 'approved') && (canPin || isPinned)
                      return (
                        <div key={imgIdx} style={{ position: 'relative' }}>
                          <AnnotatedImage
                            src={imgUrl} w={400} h={400} fit="fill" alt={`WIP ${imgIdx + 1}`}
                            onClick={() => {
                              setLightboxImages(update.images.filter(u => !isAudioUrl(u) && !isVideoUrl(u)))
                              setLightboxUrl(imgUrl)
                            }}
                            style={{ borderRadius: 8, border: isPinned ? '2px solid #F28C28' : '1px solid #E2E8F0', aspectRatio: '1', objectFit: 'cover', cursor: 'pointer', display: 'block', width: '100%' }}
                          />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); downloadMedia(imgUrl, `${task.title || 'wip'}_${imgIdx + 1}`) }}
                            title="Scarica immagine"
                            style={{
                              position: 'absolute',
                              top: 6,
                              right: 6,
                              width: 28,
                              height: 28,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: 999,
                              border: 'none',
                              cursor: 'pointer',
                              background: 'rgba(15,23,42,0.55)',
                              color: '#fff',
                              backdropFilter: 'blur(6px)',
                              WebkitBackdropFilter: 'blur(6px)',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                              opacity: 0.92,
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = '#F28C28' }}
                            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.92'; e.currentTarget.style.background = 'rgba(15,23,42,0.55)' }}
                          >
                            <IconDownload size={15} color="#fff" />
                          </button>
                          {showOverlay && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); if (canPin) handleTogglePin(update, imgUrl) }}
                              disabled={!canPin}
                              title={
                                isPinned
                                  ? (canPin ? 'Rimuovi dalla Storyboard' : 'In Storyboard')
                                  : 'Mostra in Storyboard'
                              }
                              style={{
                                position: 'absolute',
                                top: 6,
                                left: 6,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 8px 4px 6px',
                                fontSize: 10,
                                fontWeight: 700,
                                lineHeight: 1,
                                borderRadius: 999,
                                border: 'none',
                                cursor: canPin ? 'pointer' : 'default',
                                background: isPinned ? '#F28C28' : 'rgba(15,23,42,0.55)',
                                color: '#fff',
                                backdropFilter: 'blur(6px)',
                                WebkitBackdropFilter: 'blur(6px)',
                                boxShadow: isPinned ? '0 2px 8px rgba(242,140,40,0.45)' : '0 2px 6px rgba(0,0,0,0.25)',
                                opacity: isPinned ? 1 : 0.92,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => { if (canPin) e.currentTarget.style.opacity = '1' }}
                              onMouseLeave={(e) => { if (canPin && !isPinned) e.currentTarget.style.opacity = '0.92' }}
                            >
                              <IconStar size={11} color="#fff" />
                              <span>{isPinned ? 'In Storyboard' : 'Mostra in Storyboard'}</span>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
                {/* Per-WIP comments section */}
                {renderWipCardComments(update.id)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Student: WIP publish form */}
      {!staff && isOwner && task.status === 'wip' && (
        <div
          onDragEnter={handleWipDragEnter}
          onDragOver={handleWipDragOver}
          onDragLeave={handleWipDragLeave}
          onDrop={handleWipDrop}
          style={{ position: 'relative', borderTop: '1px solid #E8ECF1', padding: isMobile ? 12 : 16, background: '#FAFBFD', flexShrink: 0 }}>
          {wipDragOver && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 30,
              background: 'rgba(250,251,253,0.95)', border: '2px dashed #F28C28', borderRadius: 12,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, pointerEvents: 'none',
            }}>
              <IconImage size={28} color="#F28C28" />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#F28C28' }}>Rilascia per allegare</div>
            </div>
          )}
          <input ref={fileInputRef} type="file" accept={task.department === 'sound' ? 'image/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm,audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/x-m4a,audio/flac,audio/webm,.mp3,.wav,.ogg,.aac,.m4a,.flac' : 'image/*,video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm'} multiple onChange={handleFilesSelect} style={{ display: 'none' }} />
          {wipPreviews.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {wipPreviews.map((preview, idx) => {
                const t = wipFiles[idx]?.type || ''
                const isAudio = t.startsWith('audio/')
                const isVideo = t.startsWith('video/')
                const isAv = isAudio || isVideo
                return (
                  <div key={idx} style={{ position: 'relative', ...(isAv ? { width: 140, height: 70 } : { width: 70, height: 70 }), borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: '1px solid #E2E8F0', background: isAv ? '#F8FAFC' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isAudio ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 4 }}>
                        <span style={{ fontSize: 18 }}>&#9835;</span>
                        <span style={{ fontSize: 9, color: '#64748B', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wipFiles[idx]?.name}</span>
                      </div>
                    ) : isVideo ? (
                      <video src={preview} muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <Img src={preview} alt={`WIP ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                    <button onClick={() => handleRemoveFile(idx)} style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>X</button>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {wipFiles.length < MAX_IMAGES && (
              <button onClick={() => fileInputRef.current?.click()} style={{ width: 40, height: 40, borderRadius: 10, border: '2px dashed #CBD5E1', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#94A3B8' }}><IconImage size={18} /></button>
            )}
            <div style={{ flex: 1 }}>
              <input value={wipNote} onChange={e => setWipNote(e.target.value)} onPaste={handleWipPaste} placeholder="What did you work on?..." onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handlePublishWip())} style={{ width: '100%', padding: '10px 14px', fontSize: 13, border: '1px solid #E2E8F0', borderRadius: 10, outline: 'none', background: '#fff' }} />
            </div>
            <Btn variant="primary" loading={publishing} onClick={handlePublishWip} disabled={wipFiles.length === 0 && !wipNote.trim()} style={{ flexShrink: 0, padding: '10px 16px' }}>Publish</Btn>
          </div>
          <div style={{ fontSize: 11, color: '#B0B8C4', marginTop: 6 }}>Up to {MAX_IMAGES} {task.department === 'sound' ? 'files · 4MB immagini · 10MB audio · 100MB video' : 'files · 4MB immagini · 100MB video'} · trascina o incolla (Ctrl+V)</div>
        </div>
      )}
      {staff && task.status === 'wip' && hasWipUpdates && (
        <div style={{ borderTop: '1px solid #E8ECF1', padding: '12px 16px', background: '#FAFBFD', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#64748B' }}>
            {selectedReviewIds.size === 0
              ? `${wipUpdates.length} WIP · seleziona quali inviare`
              : `${selectedReviewIds.size} di ${wipUpdates.length} WIP selezionati`}
          </span>
          <Btn
            variant="primary"
            loading={actionLoading === 'commit'}
            onClick={handleCommitReview}
            disabled={selectedReviewIds.size === 0}
            title={selectedReviewIds.size === 0 ? 'Seleziona almeno un WIP da inviare in review' : undefined}
            style={{ padding: '10px 24px' }}
          >
            Submit for Review{selectedReviewIds.size > 0 ? ` (${selectedReviewIds.size})` : ''}
          </Btn>
        </div>
      )}
    </div>
  )

  // ── Render ──

  // ═══ MOBILE LAYOUT ═══
  if (isMobile) {
    return (
      <>
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(15,23,42,0.4)' }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, top: 40,
            background: '#fff', borderRadius: '20px 20px 0 0',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.12)',
            animation: 'slideInUp 0.2s ease', overflow: 'hidden',
          }}>
            {/* Drag handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#CBD5E1', margin: '10px auto 0' }} />
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #E8ECF1', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                {dept && <span style={{ width: 10, height: 10, borderRadius: '50%', background: dept.color, flexShrink: 0 }} />}
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</h2>
                <StatusBadge status={task.status} type="task" />
              </div>
              <button onClick={onClose} style={{ background: '#F1F5F9', border: 'none', color: '#64748B', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><IconX size={16} /></button>
            </div>
            {/* Mobile tabs — Info | WIP */}
            <div style={{ display: 'flex', borderBottom: '1px solid #E8ECF1', flexShrink: 0 }}>
              {[{ k: 'info', l: 'Info' }, { k: 'wip', l: `WIP${wipUpdates.length > 0 ? ` (${wipUpdates.length})` : ''}` }].map(t => (
                <button key={t.k} onClick={() => setMobileTab(t.k)} style={{
                  flex: 1, padding: '11px 0', fontSize: 12, fontWeight: mobileTab === t.k ? 700 : 500,
                  color: mobileTab === t.k ? '#F28C28' : '#64748B', background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: mobileTab === t.k ? '2px solid #F28C28' : '2px solid transparent',
                }}>{t.l}</button>
              ))}
            </div>
            {/* Tab content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {mobileTab === 'info' && renderInfoContent()}
              {mobileTab === 'wip' && renderWipContent()}
            </div>
          </div>
        </div>
        <ImageLightbox src={lightboxUrl} images={lightboxImages} onClose={() => { setLightboxUrl(null); setLightboxImages(null) }} user={user} addToast={addToast} />
      </>
    )
  }

  // ═══ DESKTOP LAYOUT ═══
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div onClick={e => e.stopPropagation()} style={{
          background: '#fff', borderRadius: 20,
          width: '94%', maxWidth: 1000, height: '90vh', maxHeight: 800,
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          animation: 'scaleIn 0.2s ease',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 24px', borderBottom: '1px solid #E8ECF1', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              {dept && <span style={{ width: 10, height: 10, borderRadius: '50%', background: dept.color, flexShrink: 0 }} />}
              <h2 style={{
                fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {(task.shot?.code || task.asset?.name) && (
                  <span style={{ color: '#64748B', fontWeight: 600, marginRight: 6 }}>
                    {task.shot?.code || task.asset?.name}:
                  </span>
                )}
                {task.title}
              </h2>
              <StatusBadge status={task.status} type="task" />
            </div>
            <button onClick={onClose} style={{
              background: '#F1F5F9', border: 'none', color: '#64748B', borderRadius: 8,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}>
              <IconX size={16} />
            </button>
          </div>

          {/* Body — two panels */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            {/* ──── Left Panel — Info only ──── */}
            <div style={{
              width: 340, flexShrink: 0, borderRight: '1px solid #E8ECF1',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
                {renderInfoContent()}
              </div>
            </div>

            {/* ──── Right Panel (WIP History + Per-WIP Comments) ──── */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {renderWipContent()}
            </div>
          </div>
        </div>
      </div>

      <ImageLightbox src={lightboxUrl} images={lightboxImages} onClose={() => { setLightboxUrl(null); setLightboxImages(null) }} user={user} addToast={addToast} />
    </>
  )
}
