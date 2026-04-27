import { useState, useEffect, useRef } from 'react'
import { DEPTS, isStaff, isSuperAdmin, displayRole, isAudioUrl } from '../../lib/constants'
import { getWipUpdates, getWipComments } from '../../lib/supabase'
import useIsMobile from '../../hooks/useIsMobile'
import Btn from '../ui/Btn'
import Av from '../ui/Av'
import StatusBadge from '../ui/StatusBadge'
import Input from '../ui/Input'
import Select from '../ui/Select'
import ImageLightbox from '../ui/ImageLightbox'
import { IconX, IconImage, IconSend, IconCheck } from '../ui/Icons'
import AssigneePicker from './AssigneePicker'
import { cld } from '../../lib/cld'

const MAX_IMAGES = 4
const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB
const MAX_AUDIO_SIZE = 10 * 1024 * 1024 // 10MB for audio

export default function TaskDetailModal({
  task, user, staff, profiles, onClose, onUpdate, onSetAssignees, onDelete, onReject, onAddWipComment,
  onCreateWipUpdate, onCommitForReview, onMarkWipViewed,
  addToast, requestConfirm,
}) {
  const isMobile = useIsMobile()
  const [mobileTab, setMobileTab] = useState('info') // mobile: info | wip
  // Staff inline edit fields — auto-save on blur, no toggle
  const [editTitle, setEditTitle] = useState(task.title || '')
  const [editDesc, setEditDesc] = useState(task.description || '')
  const [editDept, setEditDept] = useState(task.department || '')
  const [editStartDate, setEditStartDate] = useState(task.start_date || '')
  const [editDuration, setEditDuration] = useState(task.duration_days || 1)
  const [savedFlash, setSavedFlash] = useState(false)
  // Reset edit fields if task identity changes
  useEffect(() => {
    setEditTitle(task.title || '')
    setEditDesc(task.description || '')
    setEditDept(task.department || '')
    setEditStartDate(task.start_date || '')
    setEditDuration(task.duration_days || 1)
  }, [task.id])

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
  const blurStartDate = () => {
    const next = editStartDate || null
    if (next !== (task.start_date || null)) saveField('start_date', next)
  }
  const blurDuration = () => {
    const next = Math.max(1, parseInt(editDuration, 10) || 1)
    setEditDuration(next)
    if (next !== (task.duration_days || 1)) saveField('duration_days', next)
  }
  const [wipUpdates, setWipUpdates] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  // WIP publish form (student)
  const [wipFiles, setWipFiles] = useState([])
  const [wipPreviews, setWipPreviews] = useState([])
  const [wipNote, setWipNote] = useState('')
  const [publishing, setPublishing] = useState(false)
  // Image lightbox
  const [lightboxUrl, setLightboxUrl] = useState(null)
  // Per-WIP comments
  const [wipComments, setWipComments] = useState({})         // { [wipUpdateId]: [comment, ...] }
  const [wipCommentInputs, setWipCommentInputs] = useState({}) // { [wipUpdateId]: string }

  const fileInputRef = useRef(null)
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

  // WIP file management
  const handleFilesSelect = (e) => {
    const selected = Array.from(e.target.files || [])
    if (!selected.length) return
    const available = MAX_IMAGES - wipFiles.length
    if (available <= 0) {
      if (addToast) addToast(`Maximum ${MAX_IMAGES} images`, 'danger')
      return
    }
    const toAdd = selected.slice(0, available)
    const getMaxSize = (f) => f.type?.startsWith('audio/') ? MAX_AUDIO_SIZE : MAX_FILE_SIZE
    const oversized = toAdd.filter(f => f.size > getMaxSize(f))
    if (oversized.length > 0) {
      if (addToast) addToast(`${oversized.length} file(s) too large`, 'danger')
    }
    const valid = toAdd.filter(f => f.size <= getMaxSize(f))
    if (valid.length === 0) return
    const newPreviews = valid.map(f => URL.createObjectURL(f))
    setWipFiles(prev => [...prev, ...valid])
    setWipPreviews(prev => [...prev, ...newPreviews])
    if (fileInputRef.current) fileInputRef.current.value = ''
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

  // Staff commits for review
  const handleCommitReview = async () => {
    setActionLoading('commit')
    await onCommitForReview(task.id)
    setActionLoading(null)
    onClose()
  }

  // Per-WIP comment handler (staff only)
  const handleWipComment = async (wipUpdateId) => {
    const body = (wipCommentInputs[wipUpdateId] || '').trim()
    if (!body) return
    const { data } = await onAddWipComment(wipUpdateId, task.id, user.id, body)
    if (data) {
      setWipComments(prev => ({
        ...prev,
        [wipUpdateId]: [...(prev[wipUpdateId] || []), data],
      }))
    }
    setWipCommentInputs(prev => ({ ...prev, [wipUpdateId]: '' }))
  }

  const students = profiles ? profiles.filter(p => p.role === 'studente') : []
  const hasWipUpdates = wipUpdates.length > 0

  // ── Shared content renderers ──
  const renderInfoContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {task.asset && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>Asset</span>
          <span style={{ fontSize: 12, color: '#7C3AED', background: 'rgba(167,139,250,0.12)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(167,139,250,0.4)' }}>{task.asset.name}</span>
        </div>
      )}
      {task.shot && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>Shot</span>
          <span style={{ fontSize: 12, color: '#64748B', background: '#F1F5F9', padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0' }}>{task.shot.code}</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginTop: 4 }}>Assigned</span>
        {assignees.length === 0 ? (
          <span style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>Unassigned</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {assignees.map(a => (
              <div key={a.user.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F1F5F9', padding: '3px 10px 3px 3px', borderRadius: 999, border: '1px solid #E2E8F0' }}>
                <Av name={a.user.full_name} size={20} url={a.user.avatar_url} />
                <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500 }}>{a.user.full_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      {staff && (
        <div>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, marginBottom: 6 }}>Manage assignees (click to toggle)</div>
          <AssigneePicker
            students={students}
            selectedIds={assignees.map(a => a.user.id)}
            onToggle={toggleAssignee}
            selectedDept={task.department}
          />
        </div>
      )}
      {staff ? (
        <>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>Title</span>
              {savedFlash && <span style={{ fontSize: 10, color: '#10B981', fontWeight: 600 }}>✓ Salvato</span>}
            </div>
            <Input value={editTitle} onChange={setEditTitle} onBlur={blurTitle} placeholder="Task title" />
          </div>
          <div>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, display: 'block', marginBottom: 6 }}>Department</span>
            <Select value={editDept} onChange={changeDept} options={DEPTS.map(d => ({ value: d.id, label: d.label }))} placeholder="Select department" style={{ fontSize: 13 }} />
          </div>
          <div>
            <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, display: 'block', marginBottom: 6 }}>Description</span>
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} onBlur={blurDesc} placeholder="Description" rows={4}
              style={{ width: '100%', fontSize: 13, color: '#1a1a1a', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', outline: 'none', background: '#F8FAFC', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, display: 'block', marginBottom: 6 }}>Inizio</span>
              <input type="date" value={editStartDate}
                onChange={e => setEditStartDate(e.target.value)} onBlur={blurStartDate}
                style={{ width: '100%', fontSize: 13, color: '#1a1a1a', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', outline: 'none', background: '#F8FAFC', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, display: 'block', marginBottom: 6 }}>Durata (giorni)</span>
              <input type="number" min={1} value={editDuration}
                onChange={e => setEditDuration(e.target.value)} onBlur={blurDuration}
                style={{ width: '100%', fontSize: 13, color: '#1a1a1a', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', outline: 'none', background: '#F8FAFC', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            </div>
          </div>
        </>
      ) : task.description && (
        <div>
          <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500, display: 'block', marginBottom: 6 }}>Description</span>
          <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, margin: 0, padding: '10px 14px', background: '#F8FAFC', borderRadius: 12 }}>{task.description}</p>
        </div>
      )}
      <div style={{ height: 1, background: '#E8ECF1', margin: '4px 0' }} />
      {staff && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>Actions</span>
          {task.status === 'todo' && (
            <Btn variant="primary" loading={actionLoading === 'start'} onClick={() => handleAction('start', { status: 'wip' }, 'Task started!')} style={{ width: '100%', justifyContent: 'center' }}>Start</Btn>
          )}
          {task.status === 'wip' && hasWipUpdates && (
            <Btn variant="primary" loading={actionLoading === 'commit'} onClick={handleCommitReview} style={{ width: '100%', justifyContent: 'center' }}>Submit for Review</Btn>
          )}
          {task.status === 'review' && (
            <>
              <Btn variant="success" loading={actionLoading === 'approve'} onClick={() => handleAction('approve', { status: 'approved' }, 'Task approved!')} style={{ width: '100%', justifyContent: 'center' }}>Approve</Btn>
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
          {task.status === 'approved' && isSuperAdmin(user) && (
            <Btn variant="info" loading={actionLoading === 'reopen'}
              onClick={() => requestConfirm('Riportare questo task in WIP?', async () => {
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
              <div key={update.id} style={{ padding: isMobile ? 12 : 16, borderRadius: 14, background: '#F8FAFC', border: idx === 0 ? '1px solid #F28C2820' : '1px solid #E8ECF1' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Av name={update.author?.full_name} size={26} url={update.author?.avatar_url} />
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{update.author?.full_name}</span>
                    {idx === 0 && <span style={{ fontSize: 10, fontWeight: 600, color: '#F28C28', background: 'rgba(242,140,40,0.08)', padding: '2px 8px', borderRadius: 6, marginLeft: 8 }}>Latest</span>}
                  </div>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(update.created_at).toLocaleDateString('en', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
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
                    {update.images.map((imgUrl, imgIdx) => (
                      isAudioUrl(imgUrl) ? (
                        <div key={imgIdx} style={{ gridColumn: 'span 2', borderRadius: 8, border: '1px solid #E2E8F0', padding: 8, background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 20 }}>&#9835;</span>
                          <audio controls src={imgUrl} style={{ width: '100%', height: 36 }} preload="metadata" />
                        </div>
                      ) : (
                        <div key={imgIdx} onClick={() => setLightboxUrl(imgUrl)} style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #E2E8F0', cursor: 'pointer', aspectRatio: '1' }}>
                          <img src={cld(imgUrl, { w: 400, h: 400, fit: 'fill' })} alt={`WIP ${imgIdx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                      )
                    ))}
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
        <div style={{ borderTop: '1px solid #E8ECF1', padding: isMobile ? 12 : 16, background: '#FAFBFD', flexShrink: 0 }}>
          <input ref={fileInputRef} type="file" accept={task.department === 'sound' ? 'image/*,audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/mp4,audio/x-m4a,audio/flac,audio/webm,.mp3,.wav,.ogg,.aac,.m4a,.flac' : 'image/*'} multiple onChange={handleFilesSelect} style={{ display: 'none' }} />
          {wipPreviews.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, overflowX: 'auto', paddingBottom: 4 }}>
              {wipPreviews.map((preview, idx) => {
                const isAudio = wipFiles[idx]?.type?.startsWith('audio/')
                return (
                  <div key={idx} style={{ position: 'relative', ...(isAudio ? { width: 140, height: 70 } : { width: 70, height: 70 }), borderRadius: 10, overflow: 'hidden', flexShrink: 0, border: '1px solid #E2E8F0', background: isAudio ? '#F8FAFC' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isAudio ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: 4 }}>
                        <span style={{ fontSize: 18 }}>&#9835;</span>
                        <span style={{ fontSize: 9, color: '#64748B', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wipFiles[idx]?.name}</span>
                      </div>
                    ) : (
                      <img src={preview} alt={`WIP ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
              <input value={wipNote} onChange={e => setWipNote(e.target.value)} placeholder="What did you work on?..." onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handlePublishWip())} style={{ width: '100%', padding: '10px 14px', fontSize: 13, border: '1px solid #E2E8F0', borderRadius: 10, outline: 'none', background: '#fff' }} />
            </div>
            <Btn variant="primary" loading={publishing} onClick={handlePublishWip} disabled={wipFiles.length === 0 && !wipNote.trim()} style={{ flexShrink: 0, padding: '10px 16px' }}>Publish</Btn>
          </div>
          <div style={{ fontSize: 11, color: '#B0B8C4', marginTop: 6 }}>Up to {MAX_IMAGES} {task.department === 'sound' ? 'files (images + audio) · Max 10MB audio / 4MB images' : 'images · Max 4MB'}</div>
        </div>
      )}
      {staff && task.status === 'wip' && hasWipUpdates && (
        <div style={{ borderTop: '1px solid #E8ECF1', padding: '12px 16px', background: '#FAFBFD', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#64748B' }}>{wipUpdates.length} WIP update{wipUpdates.length === 1 ? '' : 's'}</span>
          <Btn variant="primary" loading={actionLoading === 'commit'} onClick={handleCommitReview} style={{ padding: '10px 24px' }}>Submit for Review</Btn>
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
        <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
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
          width: '94%', maxWidth: 960, height: '85vh', maxHeight: 700,
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
              }}>{task.title}</h2>
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
            {/* ──── Left Panel (300px) — Info only ──── */}
            <div style={{
              width: 300, flexShrink: 0, borderRight: '1px solid #E8ECF1',
              display: 'flex', flexDirection: 'column',
            }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
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

      <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </>
  )
}
