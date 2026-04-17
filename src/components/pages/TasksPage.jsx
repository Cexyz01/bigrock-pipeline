import { useState, useEffect, useMemo } from 'react'
import { DEPTS, TASK_STATUSES, hasPermission, ACCENT } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import Fade from '../ui/Fade'
import Btn from '../ui/Btn'
import Pill from '../ui/Pill'
import Select from '../ui/Select'
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
  const [filter, setFilter] = useState({ dept: '', status: '', user: '', shot: '' })
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [viewMode, setViewMode] = useState('all')
  const staff = hasPermission(user, 'create_edit_tasks')
  const isMobile = useIsMobile()

  // Deep link: auto-open task from notification
  useEffect(() => {
    if (deepLink?.type === 'tasks' && deepLink?.id) {
      const t = tasks.find(t => t.id === deepLink.id)
      if (t) setSelectedTask(t)
      clearDeepLink()
    }
    if (deepLink?.type === 'shotFilter' && deepLink?.id) {
      setFilter(f => ({ ...f, shot: deepLink.id }))
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
    if (filter.shot && t.shot_id !== filter.shot) return false
    return true
  })

  const students = profiles.filter(p => p.role === 'studente')

  // Group tasks by shot — always use live shots array for names and order
  const groupedByShot = useMemo(() => {
    // Build a lookup from the live shots array
    const shotLookup = {}
    shots.forEach((s, i) => { shotLookup[s.id] = { ...s, _sortIdx: i } })

    const groups = []
    const shotMap = {}
    filteredTasks.forEach(t => {
      const shotId = t.shot_id || '__none__'
      if (!shotMap[shotId]) {
        // Always prefer live shot data over stale joined t.shot
        const shot = shotId !== '__none__' ? (shotLookup[shotId] || t.shot || null) : null
        shotMap[shotId] = { shotId, shot, tasks: [] }
        groups.push(shotMap[shotId])
      }
      shotMap[shotId].tasks.push(t)
    })
    // Sort by shot sort_order (same as Shot Tracker), no-shot last
    groups.sort((a, b) => {
      if (!a.shot && b.shot) return 1
      if (a.shot && !b.shot) return -1
      if (a.shot && b.shot) {
        const seqCmp = (a.shot.sequence || '').localeCompare(b.shot.sequence || '')
        if (seqCmp !== 0) return seqCmp
        return (a.shot._sortIdx ?? a.shot.sort_order ?? 0) - (b.shot._sortIdx ?? b.shot.sort_order ?? 0)
      }
      return 0
    })
    return groups
  }, [filteredTasks, shots])

  const selectStyle = { padding: '7px 14px', fontSize: 12, borderRadius: 12 }

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
          <Select value={filter.dept} onChange={v => setFilter(f => ({ ...f, dept: v }))}
            options={DEPTS.map(d => ({ value: d.id, label: d.label }))} placeholder="All departments"
            style={selectStyle} />
          <Select value={filter.status} onChange={v => setFilter(f => ({ ...f, status: v }))}
            options={TASK_STATUSES.map(s => ({ value: s.id, label: s.label }))} placeholder="All statuses"
            style={selectStyle} />
          {staff && (
            <Select value={filter.user} onChange={v => setFilter(f => ({ ...f, user: v }))}
              options={students.map(s => ({ value: s.id, label: s.full_name }))} placeholder="All students"
              style={selectStyle} />
          )}
          {shots.length > 0 && (
            <Select value={filter.shot} onChange={v => setFilter(f => ({ ...f, shot: v }))}
              options={shots.map(s => ({ value: s.id, label: s.code }))} placeholder="All shots"
              style={selectStyle} />
          )}
        </div>
      </Fade>

      {/* Task list grouped by shot */}
      {filteredTasks.length === 0 ? (
        <EmptyState icon={<IconClipboard size={48} color="#94A3B8" />} title="No tasks" sub={staff ? 'Create the first task' : 'No tasks assigned'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groupedByShot.map((group, gi) => (
            <Fade key={group.shotId} delay={gi * 40}>
              <div>
                {/* Shot header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                  padding: '8px 12px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0',
                }}>
                  {group.shot ? (
                    <>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{group.shot.code}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>{group.shot.sequence}</span>
                      {group.shot.description && (
                        <span style={{ fontSize: 11, color: '#94A3B8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {group.shot.description}</span>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#94A3B8' }}>No Shot</span>
                  )}
                  <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginLeft: 'auto', flexShrink: 0 }}>{group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}</span>
                </div>
                {/* Tasks under this shot */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: isMobile ? 8 : 12,
                }}>
                  {group.tasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task} user={user} staff={staff}
                      onClick={() => setSelectedTask(task)}
                      wipViews={wipViews}
                    />
                  ))}
                </div>
              </div>
            </Fade>
          ))}
        </div>
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
