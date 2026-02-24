import { useState } from 'react'
import { DEPTS, getTaskStatus } from '../../lib/constants'
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

export default function TaskCard({ task, user, staff, onClick }) {
  const [h, setH] = useState(false)
  const dept = DEPTS.find(d => d.id === task.department)
  const isOwner = task.assigned_to === user.id

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        padding: 24, borderRadius: 24, cursor: 'pointer', minHeight: 160,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        background: h ? (statusHoverBg[task.status] || '#F8FAFC') : (statusBg[task.status] || '#fff'),
        border: `1px solid ${statusBorder[task.status] || '#E8ECF1'}`,
        borderLeft: isOwner ? `3px solid #6C5CE7` : `3px solid ${statusBorder[task.status] || '#E8ECF1'}`,
        transition: 'all 0.15s ease',
        transform: h ? 'translateY(-2px)' : 'none',
        boxShadow: h ? '0 8px 24px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dept?.color, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 700, flex: 1, lineHeight: 1.4, color: '#1a1a2e' }}>{task.title}</span>
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
          {task.assigned_user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Av name={task.assigned_user.full_name} size={24} url={task.assigned_user.avatar_url} mood={task.assigned_user.mood_emoji} />
              <span style={{ fontSize: 11, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.assigned_user.full_name}</span>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic' }}>Non assegnato</span>
          )}
          {task.shot && <span style={{ fontSize: 10, color: '#64748B', background: '#F1F5F9', padding: '3px 8px', borderRadius: 10, border: '1px solid #E2E8F0' }}>{task.shot.code}</span>}
        </div>
        <StatusBadge status={task.status} type="task" />
      </div>
    </div>
  )
}
