import { useState, useEffect } from 'react'
import { DEPTS, isStaff } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import Fade from '../ui/Fade'
import Btn from '../ui/Btn'
import Pill from '../ui/Pill'
import Select from '../ui/Select'
import EmptyState from '../ui/EmptyState'
import { IconClipboard } from '../ui/Icons'
import TaskCard from '../tasks/TaskCard'
import CreateTaskModal from '../tasks/CreateTaskModal'
import TaskDetailModal from '../tasks/TaskDetailModal'

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
        </div>
      </Fade>

      {/* Task grid */}
      {filteredTasks.length === 0 ? (
        <EmptyState icon={<IconClipboard size={48} color="#94A3B8" />} title="No tasks" sub={staff ? 'Create the first task' : 'No tasks assigned'} />
      ) : (
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
