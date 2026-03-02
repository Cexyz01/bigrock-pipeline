import { useState, useEffect } from 'react'
import { DEPTS, isStaff } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import Fade from '../ui/Fade'
import Btn from '../ui/Btn'
import Pill from '../ui/Pill'
import Select from '../ui/Select'
import Card from '../ui/Card'
import EmptyState from '../ui/EmptyState'
import { IconClipboard } from '../ui/Icons'
import StatusBadge from '../ui/StatusBadge'
import Av from '../ui/Av'
import TaskCard from '../tasks/TaskCard'
import CreateTaskModal from '../tasks/CreateTaskModal'
import TaskDetailModal from '../tasks/TaskDetailModal'

const statusRowBg = {
  approved: '#D1FAE5', review: '#FEF3C7', wip: '#DBEAFE', todo: '#F1F5F9',
}
const statusRowBorder = {
  approved: '#A7F3D0', review: '#FDE68A', wip: '#BFDBFE', todo: '#E2E8F0',
}
const statusRowHoverBg = {
  approved: '#A7F3D0', review: '#FDE68A', wip: '#BFDBFE', todo: '#E2E8F0',
}

export default function TasksPage({
  tasks, shots, profiles, user,
  onCreateTask, onUpdateTask, onDeleteTask, onRejectTask, onAddWipComment,
  onCreateWipUpdate, onMarkWipViewed, onCommitForReview,
  wipViews,
  addToast, requestConfirm, deepLink, clearDeepLink,
}) {
  const [filter, setFilter] = useState({ dept: '', status: '', user: '' })
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [viewMode, setViewMode] = useState('all')
  const [layout, setLayout] = useState('expanded')
  const staff = isStaff(user.role)
  const isMobile = useIsMobile()

  // Deep link: auto-open task from notification
  useEffect(() => {
    if (deepLink?.type === 'tasks' && deepLink?.id) {
      const t = tasks.find(t => t.id === deepLink.id)
      if (t) setSelectedTask(t)
      clearDeepLink()
    }
  }, [deepLink, tasks])

  // Keep selected task fresh when tasks list updates
  useEffect(() => {
    if (selectedTask) {
      const fresh = tasks.find(t => t.id === selectedTask.id)
      if (fresh) setSelectedTask(fresh)
    }
  }, [tasks])

  const filteredTasks = tasks.filter(t => {
    if (viewMode === 'mine' && !staff && t.assigned_to !== user.id) return false
    if (viewMode === 'mine' && staff && t.created_by !== user.id) return false
    if (filter.dept && t.department !== filter.dept) return false
    if (filter.status && t.status !== filter.status) return false
    if (filter.user && t.assigned_to !== filter.user) return false
    return true
  })

  const students = profiles.filter(p => p.role === 'studente')

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' }}>Tasks</h1>
            <p style={{ fontSize: 14, color: '#64748B' }}>{staff ? 'Manage all tasks' : 'Your tasks'}</p>
          </div>
          {staff && <Btn variant="primary" onClick={() => setShowCreate(true)}>+ New Task</Btn>}
        </div>
      </Fade>

      {/* Filters */}
      <Fade delay={50}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill label="All" active={viewMode === 'all'} onClick={() => setViewMode('all')} />
          <Pill label="Mine" active={viewMode === 'mine'} onClick={() => setViewMode('mine')} />
          <div style={{ width: 1, height: 22, background: '#E2E8F0', margin: '0 6px' }} />
          <Pill label="All Departments" active={!filter.dept} onClick={() => setFilter(f => ({ ...f, dept: '' }))} />
          {DEPTS.map(d => <Pill key={d.id} label={d.label} active={filter.dept === d.id} onClick={() => setFilter(f => ({ ...f, dept: d.id }))} />)}
          {staff && (
            <>
              <div style={{ width: 1, height: 22, background: '#E2E8F0', margin: '0 6px' }} />
              <Select value={filter.user} onChange={v => setFilter(f => ({ ...f, user: v }))}
                options={students.map(s => ({ value: s.id, label: s.full_name }))} placeholder="All students"
                style={{ padding: '7px 14px', fontSize: 12, borderRadius: 12 }} />
            </>
          )}
          <div style={{ width: 1, height: 22, background: '#E2E8F0', margin: '0 6px' }} />
          {/* Layout toggle */}
          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 10, padding: 2 }}>
            <button onClick={() => setLayout('expanded')} style={{
              background: layout === 'expanded' ? '#fff' : 'transparent',
              border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: layout === 'expanded' ? '#1a1a1a' : '#94A3B8',
              boxShadow: layout === 'expanded' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}>
              <span style={{ fontSize: 14 }}>▦</span>
            </button>
            <button onClick={() => setLayout('compact')} style={{
              background: layout === 'compact' ? '#fff' : 'transparent',
              border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
              fontSize: 12, fontWeight: 600, color: layout === 'compact' ? '#1a1a1a' : '#94A3B8',
              boxShadow: layout === 'compact' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease',
            }}>
              <span style={{ fontSize: 14 }}>☰</span>
            </button>
          </div>
        </div>
      </Fade>

      {/* Task grid */}
      {filteredTasks.length === 0 ? (
        <EmptyState icon={<IconClipboard size={48} color="#94A3B8" />} title="No tasks" sub={staff ? 'Create the first task' : 'No tasks assigned'} />
      ) : layout === 'expanded' ? (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: isMobile ? 12 : 20,
        }}>
          {filteredTasks.map((task, i) => (
            <Fade key={task.id} delay={Math.min(i * 20, 300)}>
              <TaskCard
                task={task} user={user} staff={staff}
                onClick={() => setSelectedTask(task)}
                wipViews={wipViews}
              />
            </Fade>
          ))}
        </div>
      ) : (
        <CompactView
          tasks={filteredTasks} user={user} staff={staff} isMobile={isMobile}
          wipViews={wipViews} onSelect={setSelectedTask}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal open={showCreate} onClose={() => setShowCreate(false)}
        shots={shots} students={students} user={user} onCreate={onCreateTask} />

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask} user={user} staff={staff} profiles={profiles}
          onClose={() => setSelectedTask(null)}
          onUpdate={onUpdateTask} onDelete={onDeleteTask} onReject={onRejectTask} onAddWipComment={onAddWipComment}
          onCreateWipUpdate={onCreateWipUpdate}
          onCommitForReview={onCommitForReview}
          onMarkWipViewed={onMarkWipViewed}
          addToast={addToast} requestConfirm={requestConfirm}
        />
      )}
    </div>
  )
}

/* ─── Compact View ─── */
function CompactView({ tasks, user, staff, isMobile, wipViews, onSelect }) {
  // Group tasks by department
  const grouped = {}
  DEPTS.forEach(d => grouped[d.id] = [])
  grouped['none'] = []
  tasks.forEach(t => {
    if (t.department && grouped[t.department]) grouped[t.department].push(t)
    else grouped['none'].push(t)
  })

  const sections = [
    ...DEPTS.map(d => ({ key: d.id, label: d.label, color: d.color, items: grouped[d.id] })),
    { key: 'none', label: 'No Department', color: '#94A3B8', items: grouped['none'] },
  ].filter(s => s.items.length > 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? 12 : 20 }}>
      {sections.map((sec, si) => (
        <Fade key={sec.key} delay={si * 40}>
          <Card>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: sec.color, flexShrink: 0 }} />
                <span style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a' }}>{sec.label}</span>
              </div>
              <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>{sec.items.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sec.items.map(task => (
                <CompactRow key={task.id} task={task} user={user} staff={staff}
                  wipViews={wipViews} onClick={() => onSelect(task)} />
              ))}
            </div>
          </Card>
        </Fade>
      ))}
    </div>
  )
}

function CompactRow({ task, user, staff, wipViews, onClick }) {
  const [h, setH] = useState(false)
  const isOwner = task.assigned_to === user.id

  const showWipBadge = staff && task.last_wip_at && (() => {
    const view = wipViews?.find(v => v.task_id === task.id)
    if (!view) return true
    return new Date(task.last_wip_at) > new Date(view.viewed_at)
  })()

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
        background: h ? statusRowHoverBg[task.status] : statusRowBg[task.status],
        border: `1px solid ${statusRowBorder[task.status] || '#E2E8F0'}`,
        borderLeft: isOwner ? '3px solid #F28C28' : `1px solid ${statusRowBorder[task.status] || '#E2E8F0'}`,
        transition: 'all 0.12s ease',
        transform: h ? 'translateY(-1px)' : 'none',
        boxShadow: h ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
        position: 'relative',
      }}
    >
      {showWipBadge && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          width: 8, height: 8, borderRadius: '50%', background: '#8B5CF6',
          boxShadow: '0 0 0 0 rgba(139, 92, 246, 0.6)',
          animation: 'wipPulse 1.5s ease-in-out infinite',
        }} />
      )}
      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {task.title}
      </span>
      {task.assigned_user && (
        <Av name={task.assigned_user.full_name} size={22} url={task.assigned_user.avatar_url} mood={task.assigned_user.mood_emoji} />
      )}
      {task.shot && (
        <span style={{ fontSize: 10, color: '#64748B', background: 'rgba(255,255,255,0.6)', padding: '2px 6px', borderRadius: 8, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {task.shot.code}
        </span>
      )}
      <StatusBadge status={task.status} type="task" />
    </div>
  )
}
