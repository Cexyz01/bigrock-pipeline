import { useState } from 'react'
import { DEPTS, getTaskStatus } from '../../lib/constants'
import StatusBadge from '../ui/StatusBadge'
import Av from '../ui/Av'

const statusBg = {
  approved: 'rgba(168,230,207,0.06)', review: 'rgba(255,234,167,0.06)', wip: 'rgba(157,196,232,0.06)', todo: '#1c1c35',
}
const statusBorder = {
  approved: 'rgba(168,230,207,0.18)', review: 'rgba(255,234,167,0.18)', wip: 'rgba(157,196,232,0.18)', todo: 'rgba(255,255,255,0.06)',
}
const statusHoverBg = {
  approved: 'rgba(168,230,207,0.10)', review: 'rgba(255,234,167,0.10)', wip: 'rgba(157,196,232,0.10)', todo: '#232345',
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
        background: h ? (statusHoverBg[task.status] || '#232345') : (statusBg[task.status] || '#1c1c35'),
        border: `1px solid ${statusBorder[task.status] || 'rgba(255,255,255,0.06)'}`,
        borderLeft: isOwner ? `3px solid #C5B3E6` : `3px solid ${statusBorder[task.status] || 'rgba(255,255,255,0.06)'}`,
        transition: 'all 0.15s ease',
        transform: h ? 'translateY(-2px)' : 'none',
        boxShadow: h ? '0 8px 24px rgba(0,0,0,0.2)' : 'none',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 18 }}>{dept?.icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, flex: 1, lineHeight: 1.4, color: '#EEEEF5' }}>{task.title}</span>
        </div>
        {task.description && (
          <div style={{
            fontSize: 13, color: '#9090B0', lineHeight: 1.6, marginBottom: 12,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{task.description}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {task.assigned_user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Av name={task.assigned_user.full_name} size={24} url={task.assigned_user.avatar_url} mood={task.assigned_user.mood_emoji} />
              <span style={{ fontSize: 11, color: '#9090B0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.assigned_user.full_name}</span>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: '#606080', fontStyle: 'italic' }}>Non assegnato</span>
          )}
          {task.shot && <span style={{ fontSize: 10, color: '#606080', background: '#1c1c35', padding: '3px 8px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>{task.shot.code}</span>}
        </div>
        <StatusBadge status={task.status} type="task" />
      </div>
    </div>
  )
}
