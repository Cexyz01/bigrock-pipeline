import { useState } from 'react'
import { DEPTS, getTaskStatus } from '../../lib/constants'
import StatusBadge from '../ui/StatusBadge'
import Av from '../ui/Av'

const statusBg = {
  approved: 'rgba(78,205,196,0.06)', review: 'rgba(240,195,109,0.06)', wip: 'rgba(124,92,252,0.06)', todo: '#12121c',
}
const statusBorder = {
  approved: 'rgba(78,205,196,0.2)', review: 'rgba(240,195,109,0.2)', wip: 'rgba(124,92,252,0.2)', todo: '#1e1e2e',
}
const statusHoverBg = {
  approved: 'rgba(78,205,196,0.1)', review: 'rgba(240,195,109,0.1)', wip: 'rgba(124,92,252,0.1)', todo: '#161622',
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
        padding: 20, borderRadius: 16, cursor: 'pointer', minHeight: 150,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        background: h ? (statusHoverBg[task.status] || '#161622') : (statusBg[task.status] || '#12121c'),
        border: `1px solid ${statusBorder[task.status] || '#1e1e2e'}`,
        borderLeft: isOwner ? `3px solid #7c5cfc` : `3px solid ${statusBorder[task.status] || '#1e1e2e'}`,
        transition: 'all 0.15s ease',
        transform: h ? 'translateY(-2px)' : 'none',
        boxShadow: h ? '0 6px 20px rgba(0,0,0,0.15)' : 'none',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 16 }}>{dept?.icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, flex: 1, lineHeight: 1.3 }}>{task.title}</span>
        </div>
        {task.description && (
          <div style={{
            fontSize: 12, color: '#888', lineHeight: 1.5, marginBottom: 10,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>{task.description}</div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {task.assigned_user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Av name={task.assigned_user.full_name} size={22} url={task.assigned_user.avatar_url} mood={task.assigned_user.mood_emoji} />
              <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.assigned_user.full_name}</span>
            </div>
          ) : (
            <span style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>Non assegnato</span>
          )}
          {task.shot && <span style={{ fontSize: 10, color: '#666', background: '#1a1a28', padding: '2px 6px', borderRadius: 6 }}>{task.shot.code}</span>}
        </div>
        <StatusBadge status={task.status} type="task" />
      </div>
    </div>
  )
}
