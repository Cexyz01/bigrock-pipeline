import { useState, useEffect } from 'react'
import { DEPTS, isStaff } from '../../lib/constants'
import { getComments } from '../../lib/supabase'
import Modal from '../ui/Modal'
import Btn from '../ui/Btn'
import Av from '../ui/Av'
import StatusBadge from '../ui/StatusBadge'
import Input from '../ui/Input'
import Select from '../ui/Select'

export default function TaskDetailModal({ task, user, staff, profiles, onClose, onUpdate, onDelete, onComment, addToast, requestConfirm }) {
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const dept = DEPTS.find(d => d.id === task.department)
  const isOwner = task.assigned_to === user.id
  const canComment = staff || isOwner

  useEffect(() => {
    getComments(task.id).then(c => { setComments(c); setLoading(false) })
  }, [task.id])

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
          {isOwner && task.status === 'todo' && (
            <Btn variant="primary" loading={actionLoading === 'start'} onClick={() => handleAction('start', { status: 'wip' }, 'Task avviato!')}>
              Inizia
            </Btn>
          )}
          {isOwner && task.status === 'wip' && (
            <Btn variant="primary" loading={actionLoading === 'submit'} onClick={() => handleAction('submit', { status: 'review' }, 'Task inviato per review!')}>
              Invia per Review
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
