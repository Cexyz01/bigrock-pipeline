import { useState, useEffect, useRef } from 'react'
import { DEPTS, isStaff } from '../../lib/constants'
import { getComments } from '../../lib/supabase'
import { uploadWipImagesToMiro, fileToBase64 } from '../../lib/miro'
import Modal from '../ui/Modal'
import Btn from '../ui/Btn'
import Av from '../ui/Av'
import StatusBadge from '../ui/StatusBadge'
import Input from '../ui/Input'
import Select from '../ui/Select'

const MAX_IMAGES = 4
const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB

export default function TaskDetailModal({ task, user, staff, profiles, onClose, onUpdate, onDelete, onComment, addToast, requestConfirm }) {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [wipFiles, setWipFiles] = useState([])
  const [wipPreviews, setWipPreviews] = useState([])
  const commentsEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const dept = DEPTS.find(d => d.id === task.department)
  const isOwner = task.assigned_to === user.id
  const canComment = staff || isOwner

  useEffect(() => {
    getComments(task.id).then(c => { setComments(c); setLoading(false) })
  }, [task.id])

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => wipPreviews.forEach(url => URL.revokeObjectURL(url))
  }, [])

  // Scroll commenti in fondo quando caricati o quando ne arriva uno nuovo
  useEffect(() => {
    if (comments.length > 0) {
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [comments])

  const handleAction = async (action, updates, successMsg) => {
    setActionLoading(action)
    await onUpdate(task.id, updates)
    if (addToast) addToast(successMsg, 'success')
    setActionLoading(null)
    onClose()
  }

  const handleComment = async () => {
    if (!newComment.trim()) return
    const { data } = await onComment(task.id, user.id, newComment.trim())
    if (data) setComments(prev => [...prev, data])
    setNewComment('')
  }

  const handleDelete = () => {
    requestConfirm(`Eliminare il task "${task.title}"?`, () => { onDelete(task.id); onClose() })
  }

  const handleAssign = async (userId) => {
    await onUpdate(task.id, { assigned_to: userId || null })
    if (addToast) addToast('Assegnazione aggiornata', 'success')
  }

  const handleFilesSelect = (e) => {
    const selected = Array.from(e.target.files || [])
    if (!selected.length) return

    // Check how many slots are available
    const available = MAX_IMAGES - wipFiles.length
    if (available <= 0) {
      if (addToast) addToast(`Massimo ${MAX_IMAGES} immagini`, 'danger')
      return
    }

    const toAdd = selected.slice(0, available)
    const oversized = toAdd.filter(f => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) {
      if (addToast) addToast(`${oversized.length} immagine/i troppo grandi (max 4MB)`, 'danger')
    }
    const valid = toAdd.filter(f => f.size <= MAX_FILE_SIZE)
    if (valid.length === 0) return

    const newPreviews = valid.map(f => URL.createObjectURL(f))
    setWipFiles(prev => [...prev, ...valid])
    setWipPreviews(prev => [...prev, ...newPreviews])

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleRemoveFile = (index) => {
    URL.revokeObjectURL(wipPreviews[index])
    setWipFiles(prev => prev.filter((_, i) => i !== index))
    setWipPreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmitForReview = async () => {
    setActionLoading('submit')
    // Upload images to Miro if any were selected and task has a shot
    if (wipFiles.length > 0 && task.shot_id) {
      try {
        const base64Array = await Promise.all(wipFiles.map(f => fileToBase64(f)))
        await uploadWipImagesToMiro(task.shot_id, task.department, task.id, base64Array, user.id)
      } catch (err) {
        console.warn('Miro upload failed:', err)
        // Don't block the review — Miro is fire-and-forget
      }
    }
    await onUpdate(task.id, { status: 'review' })
    if (addToast) addToast('Task inviato per review!', 'success')
    setActionLoading(null)
    onClose()
  }

  const students = profiles ? profiles.filter(p => p.role === 'studente') : []

  return (
    <Modal open={true} onClose={onClose} title={`${dept?.label || ''} — ${task.title}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Info */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusBadge status={task.status} type="task" />
          {task.shot && <span style={{ fontSize: 12, color: '#64748B', background: '#F1F5F9', padding: '4px 10px', borderRadius: 6, border: '1px solid #E2E8F0' }}>{task.shot.code}</span>}
          {task.assigned_user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Av name={task.assigned_user.full_name} size={22} url={task.assigned_user.avatar_url} />
              <span style={{ fontSize: 12, color: '#64748B' }}>{task.assigned_user.full_name}</span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>Non assegnato</span>
          )}
        </div>

        {/* Assign (staff, unassigned) */}
        {staff && (
          <Select
            value={task.assigned_to || ''}
            onChange={handleAssign}
            options={students.map(s => ({ value: s.id, label: s.full_name }))}
            placeholder="Assegna a studente..."
            style={{ fontSize: 12 }}
          />
        )}

        {task.description && <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, padding: '10px 14px', background: '#F8FAFC', borderRadius: 12 }}>{task.description}</p>}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* Staff: full control — start, approve, reject, delete */}
          {staff && task.status === 'todo' && (
            <Btn variant="primary" loading={actionLoading === 'start'} onClick={() => handleAction('start', { status: 'wip' }, 'Task avviato!')}>
              Inizia
            </Btn>
          )}
          {staff && task.status === 'review' && (
            <Btn variant="success" loading={actionLoading === 'approve'} onClick={() => handleAction('approve', { status: 'approved' }, 'Task approvato!')}>
              Approva
            </Btn>
          )}
          {staff && task.status === 'review' && (
            <Btn variant="danger" loading={actionLoading === 'reject'} onClick={() => handleAction('reject', { status: 'wip' }, 'Revisione richiesta')}>
              Richiedi Modifiche
            </Btn>
          )}
          {staff && <Btn variant="danger" onClick={handleDelete}>Elimina</Btn>}

          {/* Student: WIP image upload + Submit for Review */}
          {!staff && isOwner && task.status === 'wip' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              {/* Multi-image drop zone — only if task has a shot linked */}
              {task.shot_id && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFilesSelect}
                    style={{ display: 'none' }}
                  />

                  {/* Image preview grid */}
                  {wipPreviews.length > 0 && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: wipPreviews.length === 1 ? '1fr' : '1fr 1fr',
                      gap: 8,
                      marginBottom: 8,
                    }}>
                      {wipPreviews.map((preview, idx) => (
                        <div key={idx} style={{
                          position: 'relative',
                          borderRadius: 10,
                          overflow: 'hidden',
                          background: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                        }}>
                          <img
                            src={preview}
                            alt={`WIP ${idx + 1}`}
                            style={{
                              width: '100%',
                              height: 120,
                              objectFit: 'cover',
                              display: 'block',
                            }}
                          />
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRemoveFile(idx) }}
                            style={{
                              position: 'absolute', top: 4, right: 4,
                              width: 22, height: 22, borderRadius: '50%',
                              background: 'rgba(0,0,0,0.55)', color: '#fff',
                              border: 'none', cursor: 'pointer', fontSize: 12,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              lineHeight: 1,
                            }}
                          >
                            X
                          </button>
                          <div style={{
                            fontSize: 10, color: '#94A3B8', padding: '3px 6px',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {wipFiles[idx]?.name}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add image button / drop zone */}
                  {wipFiles.length < MAX_IMAGES && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        border: '2px dashed #E2E8F0', borderRadius: 12,
                        padding: '16px 12px', textAlign: 'center',
                        cursor: 'pointer', background: '#F8FAFC',
                        transition: 'border-color 0.2s ease',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#6C5CE7'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                    >
                      <div style={{ fontSize: 18, marginBottom: 2 }}>
                        {wipFiles.length === 0 ? '\uD83D\uDDBC\uFE0F' : '+'}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B' }}>
                        {wipFiles.length === 0
                          ? 'Allega immagini WIP per Miro'
                          : `Aggiungi immagine (${wipFiles.length}/${MAX_IMAGES})`
                        }
                      </div>
                      {wipFiles.length === 0 && (
                        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                          Fino a {MAX_IMAGES} immagini · Max 4MB ciascuna · PNG, JPG, WEBP
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <Btn variant="primary" loading={actionLoading === 'submit'} onClick={handleSubmitForReview}>
                Invia per Review
              </Btn>
            </div>
          )}
        </div>

        {/* Comments */}
        <div style={{ borderTop: '1px solid #E8ECF1', paddingTop: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#1a1a2e' }}>Commenti</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
            {loading ? <span style={{ color: '#94A3B8', fontSize: 13 }}>Caricamento...</span> :
              comments.length === 0 ? <span style={{ color: '#94A3B8', fontSize: 13 }}>Nessun commento</span> :
              comments.map(c => (
                <div key={c.id} style={{ padding: '12px 14px', borderRadius: 10, background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Av name={c.author?.full_name} size={20} url={c.author?.avatar_url} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}>{c.author?.full_name}</span>
                    {c.author?.role !== 'studente' && <span style={{ fontSize: 10, color: '#6C5CE7', background: 'rgba(108,92,231,0.08)', padding: '1px 6px', borderRadius: 4 }}>{c.author?.role}</span>}
                    <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 'auto' }}>{new Date(c.created_at).toLocaleDateString('it')}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.5 }}>{c.body}</div>
                </div>
              ))
            }
            <div ref={commentsEndRef} />
          </div>
          {canComment && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Input value={newComment} onChange={setNewComment} placeholder="Scrivi un commento..."
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleComment())} style={{ flex: 1 }} />
              <Btn variant="primary" onClick={handleComment}>Invia</Btn>
            </div>
          )}
          {!canComment && <p style={{ fontSize: 12, color: '#94A3B8' }}>Solo lo studente assegnato e lo staff possono commentare.</p>}
        </div>
      </div>
    </Modal>
  )
}
