import { useState, useEffect } from 'react'
import { DEPTS, isStaff } from '../../lib/constants'
import Fade from '../ui/Fade'
import Btn from '../ui/Btn'
import Pill from '../ui/Pill'
import Select from '../ui/Select'
import EmptyState from '../ui/EmptyState'
import TaskCard from '../tasks/TaskCard'
import CreateTaskModal from '../tasks/CreateTaskModal'
import TaskDetailModal from '../tasks/TaskDetailModal'

export default function TasksPage({ tasks, shots, profiles, user, onCreateTask, onUpdateTask, onDeleteTask, onAddComment, addToast, requestConfirm, deepLink, clearDeepLink }) {
  const [filter, setFilter] = useState({ dept: '', status: '', user: '' })
  const [showCreate, setShowCreate] = useState(false)
  const [selectedTask, setSelectedTask] = useState(null)
  const [viewMode, setViewMode] = useState('all')
  const staff = isStaff(user.role)

  // Deep link: auto-open task from notification
  useEffect(() => {
    if (deepLink?.type === 'tasks' && deepLink?.id) {
      const t = tasks.find(t => t.id === deepLink.id)
      if (t) setSelectedTask(t)
      clearDeepLink()
    }
  }, [deepLink, tasks])

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px', color: '#f0f0f5' }}>📋 Tasks</h1>
            <p style={{ fontSize: 14, color: '#555' }}>{staff ? 'Gestisci tutti i task' : 'I tuoi task'}</p>
          </div>
          {staff && <Btn variant="primary" onClick={() => setShowCreate(true)}>+ Nuovo Task</Btn>}
        </div>
      </Fade>

      {/* Filters */}
      <Fade delay={50}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <Pill label="Tutti" active={viewMode === 'all'} onClick={() => setViewMode('all')} />
          <Pill label="I Miei" active={viewMode === 'mine'} onClick={() => setViewMode('mine')} />
          <div style={{ width: 1, height: 22, background: '#1e1e2e', margin: '0 4px' }} />
          <Pill label="Tutti i Reparti" active={!filter.dept} onClick={() => setFilter(f => ({ ...f, dept: '' }))} />
          {DEPTS.map(d => <Pill key={d.id} label={`${d.icon} ${d.label}`} active={filter.dept === d.id} onClick={() => setFilter(f => ({ ...f, dept: d.id }))} />)}
          {staff && (
            <>
              <div style={{ width: 1, height: 22, background: '#1e1e2e', margin: '0 4px' }} />
              <Select value={filter.user} onChange={v => setFilter(f => ({ ...f, user: v }))}
                options={students.map(s => ({ value: s.id, label: s.full_name }))} placeholder="Tutti gli studenti"
                style={{ padding: '6px 12px', fontSize: 12, borderRadius: 10 }} />
            </>
          )}
        </div>
      </Fade>

      {/* Task grid */}
      {filteredTasks.length === 0 ? (
        <EmptyState icon="📋" title="Nessun task" sub={staff ? 'Crea il primo task' : 'Nessun task assegnato'} />
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}>
          {filteredTasks.map((task, i) => (
            <Fade key={task.id} delay={Math.min(i * 20, 300)}>
              <TaskCard task={task} user={user} staff={staff} onClick={() => setSelectedTask(task)} />
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
          onUpdate={onUpdateTask} onDelete={onDeleteTask} onComment={onAddComment}
          addToast={addToast} requestConfirm={requestConfirm}
        />
      )}
    </div>
  )
}
