import { useState, useEffect, useMemo, useCallback } from 'react'
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
  tasks, shots, assets = [], profiles, user,
  onCreateTask, onUpdateTask, onReorderTasks, onDeleteTask, onRejectTask, onAddWipComment,
  onCreateWipUpdate, onMarkWipViewed, onCommitForReview,
  wipViews,
  addToast, requestConfirm, deepLink, clearDeepLink,
}) {
  const [filter, setFilter] = useState({ dept: '', status: '', user: '', shot: '', asset: '' })
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
      setFilter(f => ({ ...f, shot: deepLink.id, asset: '' }))
      clearDeepLink()
    }
    if (deepLink?.type === 'assetFilter' && deepLink?.id) {
      setFilter(f => ({ ...f, asset: deepLink.id, shot: '' }))
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
    if (filter.asset && t.asset_id !== filter.asset) return false
    return true
  })

  const students = profiles.filter(p => p.role === 'studente')

  // Group tasks by container (asset, then shot, then unassigned).
  // Asset groups are listed first.
  const groupedTasks = useMemo(() => {
    const shotLookup = {}
    shots.forEach((s, i) => { shotLookup[s.id] = { ...s, _sortIdx: i } })
    const assetLookup = {}
    assets.forEach((a, i) => { assetLookup[a.id] = { ...a, _sortIdx: i } })

    const assetGroups = {}
    const shotGroups = {}
    let noneGroup = null

    filteredTasks.forEach(t => {
      if (t.asset_id) {
        const key = t.asset_id
        if (!assetGroups[key]) {
          const asset = assetLookup[key] || t.asset || null
          assetGroups[key] = { kind: 'asset', key: 'a:' + key, asset, tasks: [] }
        }
        assetGroups[key].tasks.push(t)
      } else if (t.shot_id) {
        const key = t.shot_id
        if (!shotGroups[key]) {
          const shot = shotLookup[key] || t.shot || null
          shotGroups[key] = { kind: 'shot', key: 's:' + key, shot, tasks: [] }
        }
        shotGroups[key].tasks.push(t)
      } else {
        if (!noneGroup) noneGroup = { kind: 'none', key: 'none', tasks: [] }
        noneGroup.tasks.push(t)
      }
    })

    // Sort each group's tasks: oldest first (sort_order ASC, then created_at ASC)
    const sortTasks = (arr) => arr.sort((a, b) => {
      const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER
      const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER
      if (ao !== bo) return ao - bo
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })
    Object.values(assetGroups).forEach(g => sortTasks(g.tasks))
    Object.values(shotGroups).forEach(g => sortTasks(g.tasks))
    if (noneGroup) sortTasks(noneGroup.tasks)

    const assetArr = Object.values(assetGroups).sort((a, b) => {
      const ai = a.asset?._sortIdx ?? a.asset?.sort_order ?? 0
      const bi = b.asset?._sortIdx ?? b.asset?.sort_order ?? 0
      return ai - bi
    })
    const shotArr = Object.values(shotGroups).sort((a, b) => {
      const seqCmp = (a.shot?.sequence || '').localeCompare(b.shot?.sequence || '')
      if (seqCmp !== 0) return seqCmp
      return (a.shot?._sortIdx ?? a.shot?.sort_order ?? 0) - (b.shot?._sortIdx ?? b.shot?.sort_order ?? 0)
    })
    return [...assetArr, ...shotArr, ...(noneGroup ? [noneGroup] : [])]
  }, [filteredTasks, shots, assets])

  const selectStyle = { padding: '7px 14px', fontSize: 12, borderRadius: 12 }

  // Drag-reorder within the same group (asset/shot/none).
  const handleTaskDrop = useCallback((draggedId, targetId) => {
    if (draggedId === targetId) return
    const dragged = tasks.find(t => t.id === draggedId)
    const target = tasks.find(t => t.id === targetId)
    if (!dragged || !target) return
    const sameGroup = (dragged.asset_id || null) === (target.asset_id || null)
                  && (dragged.shot_id || null) === (target.shot_id || null)
    if (!sameGroup) return

    const groupKey = dragged.asset_id || dragged.shot_id || 'none'
    const groupTasks = tasks
      .filter(t => (t.asset_id || t.shot_id || 'none') === groupKey)
      .sort((a, b) => {
        const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER
        const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER
        if (ao !== bo) return ao - bo
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })

    const without = groupTasks.filter(t => t.id !== draggedId)
    const targetIdx = without.findIndex(t => t.id === targetId)
    without.splice(targetIdx, 0, dragged)
    const changes = without
      .map((t, i) => (t.sort_order !== i ? { id: t.id, updates: { sort_order: i } } : null))
      .filter(Boolean)
    if (changes.length === 0) return
    if (onReorderTasks) onReorderTasks(changes)
    else changes.forEach(c => onUpdateTask(c.id, c.updates))
  }, [tasks, onReorderTasks, onUpdateTask])

  const handleStartTask = useCallback((task) => {
    onUpdateTask(task.id, { status: 'wip' })
    if (addToast) addToast('Task avviato', 'success')
  }, [onUpdateTask, addToast])

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
            <Select value={filter.shot} onChange={v => setFilter(f => ({ ...f, shot: v, asset: v ? '' : f.asset }))}
              options={shots.map(s => ({ value: s.id, label: s.code }))} placeholder="All shots"
              style={selectStyle} />
          )}
          {assets.length > 0 && (
            <Select value={filter.asset} onChange={v => setFilter(f => ({ ...f, asset: v, shot: v ? '' : f.shot }))}
              options={assets.map(a => ({ value: a.id, label: a.name }))} placeholder="All assets"
              style={selectStyle} />
          )}
        </div>
      </Fade>

      {/* Task list grouped by asset / shot */}
      {filteredTasks.length === 0 ? (
        <EmptyState icon={<IconClipboard size={48} color="#94A3B8" />} title="No tasks" sub={staff ? 'Create the first task' : 'No tasks assigned'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {groupedTasks.map((group, gi) => (
            <Fade key={group.key} delay={gi * 40}>
              <div>
                {/* Group header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                  padding: '8px 12px',
                  background: group.kind === 'asset' ? 'rgba(167,139,250,0.08)' : '#F8FAFC',
                  borderRadius: 10,
                  border: `1px solid ${group.kind === 'asset' ? 'rgba(167,139,250,0.4)' : '#E2E8F0'}`,
                }}>
                  {group.kind === 'asset' && group.asset ? (
                    <>
                      <span style={{ fontSize: 9, fontWeight: 700, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'rgba(167,139,250,0.18)', padding: '2px 6px', borderRadius: 4 }}>Asset</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{group.asset.name}</span>
                      {group.asset.description && (
                        <span style={{ fontSize: 11, color: '#94A3B8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {group.asset.description}</span>
                      )}
                    </>
                  ) : group.kind === 'shot' && group.shot ? (
                    <>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>{group.shot.code}</span>
                      <span style={{ fontSize: 11, color: '#94A3B8' }}>{group.shot.sequence}</span>
                      {group.shot.description && (
                        <span style={{ fontSize: 11, color: '#94A3B8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {group.shot.description}</span>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#94A3B8' }}>No Shot / Asset</span>
                  )}
                  <span style={{ fontSize: 11, color: '#64748B', fontWeight: 600, marginLeft: 'auto', flexShrink: 0 }}>{group.tasks.length} task{group.tasks.length !== 1 ? 's' : ''}</span>
                </div>
                {/* Tasks under this group */}
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
                      onStart={handleStartTask}
                      draggable
                      onDrop={handleTaskDrop}
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
        shots={shots} assets={assets} students={students} user={user} onCreate={onCreateTask} />

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
