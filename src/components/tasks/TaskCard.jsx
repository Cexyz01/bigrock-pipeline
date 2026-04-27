import { useState, useCallback } from 'react'
import { DEPTS } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import StatusBadge from '../ui/StatusBadge'
import Av from '../ui/Av'

const statusBg = {
  approved: '#A7F3D0', review: '#FDE68A', wip: '#BFDBFE', todo: '#E2E8F0',
}
const statusBorder = {
  approved: '#05966950', review: '#D9770650', wip: '#2563EB50', todo: '#94A3B850',
}
const statusHoverBg = {
  approved: '#6EE7B7', review: '#FCD34D', wip: '#93C5FD', todo: '#CBD5E1',
}

export default function TaskCard({ task, user, staff, onClick, wipViews, onStart, draggable = false, onDragStart, onDrop }) {
  const isMobile = useIsMobile()
  const [h, setH] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const dept = DEPTS.find(d => d.id === task.department)
  const assignees = task.assignees || []
  const isOwner = assignees.some(a => a.user.id === user.id)
  const canStart = task.status === 'todo' && (isOwner || staff) && onStart
  // Late-start indicator: TO DO task whose planned start_date is today or earlier.
  const overdueStart = task.status === 'todo' && task.start_date && (() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const [y, m, d] = task.start_date.split('-').map(Number)
    return new Date(y, m - 1, d) <= today
  })()

  const handleStartClick = useCallback((e) => {
    e.stopPropagation()
    onStart?.(task)
  }, [task, onStart])

  const handleDragStartCb = useCallback((e) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
    onDragStart?.(task.id)
  }, [task.id, onDragStart])

  const handleDragOverCb = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }, [])

  const handleDragLeaveCb = useCallback(() => setDragOver(false), [])

  const handleDropCb = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const draggedId = e.dataTransfer.getData('text/plain')
    if (draggedId && draggedId !== task.id) onDrop?.(draggedId, task.id)
  }, [task.id, onDrop])

  // WIP badge: show when task has new WIP updates unseen by this staff member
  const showWipBadge = staff && task.last_wip_at && (() => {
    const view = wipViews?.find(v => v.task_id === task.id)
    if (!view) return true // never viewed
    return new Date(task.last_wip_at) > new Date(view.viewed_at)
  })()

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      draggable={draggable}
      onDragStart={draggable ? handleDragStartCb : undefined}
      onDragOver={draggable ? handleDragOverCb : undefined}
      onDragLeave={draggable ? handleDragLeaveCb : undefined}
      onDrop={draggable ? handleDropCb : undefined}
      style={{
        padding: isMobile ? 14 : 18, borderRadius: isMobile ? 14 : 20, cursor: draggable ? 'grab' : 'pointer', minHeight: isMobile ? 96 : 128,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        background: h ? (statusHoverBg[task.status] || '#F8FAFC') : (statusBg[task.status] || '#fff'),
        border: `1px solid ${dragOver ? '#F28C28' : (statusBorder[task.status] || '#E8ECF1')}`,
        borderLeft: isOwner ? `3px solid #F28C28` : `3px solid ${statusBorder[task.status] || '#E8ECF1'}`,
        transition: 'all 0.15s ease',
        transform: h ? 'translateY(-2px)' : 'none',
        boxShadow: dragOver ? '0 0 0 2px #F28C28' : (h ? '0 8px 24px rgba(0,0,0,0.08)' : 'none'),
        position: 'relative',
      }}
    >
      {/* WIP Badge — purple dot with pulse */}
      {showWipBadge && (
        <span style={{
          position: 'absolute', top: 12, right: 12,
          width: 12, height: 12, borderRadius: '50%',
          background: '#8B5CF6',
          boxShadow: '0 0 0 0 rgba(139, 92, 246, 0.6)',
          animation: 'wipPulse 1.5s ease-in-out infinite',
        }} />
      )}

      {/* Late-start indicator — orange pulsing dot when planned start date has arrived but task is still TO DO */}
      {overdueStart && (
        <span title="Doveva iniziare oggi o prima" style={{
          position: 'absolute', top: 12, right: showWipBadge ? 30 : 12,
          width: 12, height: 12, borderRadius: '50%',
          background: '#F59E0B',
          boxShadow: '0 0 0 0 rgba(245, 158, 11, 0.6)',
          animation: 'lateStartPulse 1.5s ease-in-out infinite',
        }} />
      )}

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dept?.color, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 700, flex: 1, lineHeight: 1.4, color: '#1a1a1a' }}>{task.title}</span>
        </div>
        {task.description && (
          <div style={{
            fontSize: 13, color: '#64748B', lineHeight: 1.6, marginBottom: 12,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{task.description}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {assignees.length === 0 ? (
            <span style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>Unassigned</span>
          ) : assignees.length === 1 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Av name={assignees[0].user.full_name} size={24} url={assignees[0].user.avatar_url} mood={assignees[0].user.mood_emoji} />
              <span style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{assignees[0].user.full_name}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex' }}>
                {assignees.slice(0, 4).map((a, i) => (
                  <div key={a.user.id} style={{ marginLeft: i === 0 ? 0 : -8, border: '2px solid #fff', borderRadius: '50%', display: 'flex' }}>
                    <Av name={a.user.full_name} size={24} url={a.user.avatar_url} mood={a.user.mood_emoji} />
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 11, color: '#64748B' }}>{assignees.length}</span>
            </div>
          )}
          {task.shot && <span style={{ fontSize: 10, color: '#64748B', background: '#F1F5F9', padding: '3px 8px', borderRadius: 10, border: '1px solid #E2E8F0' }}>{task.shot.code}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {canStart && (
            <button onClick={handleStartClick} style={{
              fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 8,
              background: '#10B981', color: '#fff', border: 'none', cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#059669'}
              onMouseLeave={e => e.currentTarget.style.background = '#10B981'}
            >▶ Start</button>
          )}
          <StatusBadge status={task.status} type="task" />
        </div>
      </div>

      {/* Keyframes for WIP pulse */}
      <style>{`
        @keyframes wipPulse {
          0% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.6); }
          70% { box-shadow: 0 0 0 8px rgba(139, 92, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0); }
        }
        @keyframes lateStartPulse {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.6); }
          70% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
      `}</style>
    </div>
  )
}
