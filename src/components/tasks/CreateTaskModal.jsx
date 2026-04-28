import { useState, useEffect } from 'react'
import { SHOT_DEPTS, ASSET_DEPTS, ACCENT } from '../../lib/constants'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Btn from '../ui/Btn'
import AssigneePicker from './AssigneePicker'

export default function CreateTaskModal({ open, onClose, shots, assets = [], students, user, onCreate, prefill, projectStartDate }) {
  // target: 'shot' or 'asset'
  const [target, setTarget] = useState('shot')
  const [form, setForm] = useState({ title: '', description: '', department: '', assignee_ids: [], shot_id: '', asset_id: '', startNow: false, start_date: '', duration_days: 5, required_assignees: 1 })

  // Apply prefill (asset_id / shot_id) when modal opens; seed start date from project.
  useEffect(() => {
    if (!open) return
    setForm(f => ({ ...f, start_date: f.start_date || projectStartDate || '' }))
    if (prefill?.asset_id) {
      setTarget('asset')
      setForm(f => ({ ...f, asset_id: prefill.asset_id, shot_id: '' }))
    } else if (prefill?.shot_id) {
      setTarget('shot')
      setForm(f => ({ ...f, shot_id: prefill.shot_id, asset_id: '' }))
    }
  }, [open, prefill?.asset_id, prefill?.shot_id, projectStartDate])

  const depts = target === 'asset' ? ASSET_DEPTS : SHOT_DEPTS

  const sortedShots = [...(shots || [])].sort((a, b) =>
    (a.sequence || '').localeCompare(b.sequence || '') ||
    ((a.sort_order ?? 0) - (b.sort_order ?? 0)) ||
    (a.code || '').localeCompare(b.code || '')
  )
  const sortedAssets = [...(assets || [])].sort((a, b) =>
    ((a.sort_order ?? 0) - (b.sort_order ?? 0)) ||
    (a.name || '').localeCompare(b.name || '')
  )

  const truncate = (s, n = 40) => !s ? '' : (s.length > n ? s.slice(0, n - 1) + '…' : s)

  const handleCreate = async () => {
    if (!form.title || !form.department) return
    const duration = Math.max(1, parseInt(form.duration_days, 10) || 1)
    const required = Math.max(1, parseInt(form.required_assignees, 10) || 1)
    await onCreate({
      title: form.title,
      description: form.description,
      department: form.department,
      assignee_ids: form.assignee_ids || [],
      shot_id: target === 'shot' ? (form.shot_id || null) : null,
      asset_id: target === 'asset' ? (form.asset_id || null) : null,
      created_by: user.id,
      status: form.startNow ? 'wip' : 'todo',
      start_date: form.start_date || null,
      duration_days: duration,
      required_assignees: required,
    })
    setForm({ title: '', description: '', department: '', assignee_ids: [], shot_id: '', asset_id: '', startNow: false, start_date: projectStartDate || '', duration_days: 5, required_assignees: 1 })
    setTarget('shot')
    onClose()
  }

  const toggleAssignee = (uid) => setForm(f => {
    const has = f.assignee_ids.includes(uid)
    return { ...f, assignee_ids: has ? f.assignee_ids.filter(x => x !== uid) : [...f.assignee_ids, uid] }
  })

  const handleSetTarget = (next) => {
    setTarget(next)
    // Reset department when switching, since available depts differ
    setForm(f => ({ ...f, department: '', shot_id: '', asset_id: '', assignee_ids: [] }))
  }

  const tabBtnStyle = (active) => ({
    flex: 1, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    borderRadius: 8, border: `1.5px solid ${active ? ACCENT : '#E2E8F0'}`,
    background: active ? `${ACCENT}18` : '#fff',
    color: active ? ACCENT : '#64748B', transition: 'all 0.15s ease',
  })

  return (
    <Modal open={open} onClose={onClose} title="New Task">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Target type switcher */}
        <div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>Tipologia task</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={() => handleSetTarget('shot')} style={tabBtnStyle(target === 'shot')}>Shot</button>
            <button type="button" onClick={() => handleSetTarget('asset')} style={tabBtnStyle(target === 'asset')}>Asset</button>
          </div>
        </div>

        <Input value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Task title" />
        <Input value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Description (optional)" multiline />
        <Select value={form.department} onChange={v => setForm(f => ({ ...f, department: v }))}
          options={depts.map(d => ({ value: d.id, label: d.label }))} placeholder="Select department" />
        <div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>Assign to students (optional, multi)</div>
          <AssigneePicker students={students} selectedIds={form.assignee_ids} onToggle={toggleAssignee} selectedDept={form.department} />
        </div>

        {target === 'shot' ? (
          <Select value={form.shot_id} onChange={v => setForm(f => ({ ...f, shot_id: v || null }))}
            style={{ fontSize: 12 }}
            options={sortedShots.map(s => {
              const desc = s.description ? truncate(s.description) : s.sequence
              return { value: s.id, label: `${s.code}  ·  ${desc || ''}` }
            })} placeholder="Link to shot (optional)" />
        ) : (
          <Select value={form.asset_id} onChange={v => setForm(f => ({ ...f, asset_id: v || null }))}
            style={{ fontSize: 12 }}
            options={sortedAssets.map(a => ({ value: a.id, label: a.name }))} placeholder="Link to asset (optional)" />
        )}

        {/* Schedule */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>Inizio (opzionale)</div>
            <input type="date" value={form.start_date}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              style={{ width: '100%', fontSize: 13, color: '#1a1a1a', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', outline: 'none', background: '#F8FAFC', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>Durata (giorni)</div>
            <input type="number" min={1} value={form.duration_days}
              onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))}
              style={{ width: '100%', fontSize: 13, color: '#1a1a1a', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', outline: 'none', background: '#F8FAFC', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>Persone richieste</div>
            <input type="number" min={1} value={form.required_assignees}
              onChange={e => setForm(f => ({ ...f, required_assignees: e.target.value }))}
              style={{ width: '100%', fontSize: 13, color: '#1a1a1a', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', outline: 'none', background: '#F8FAFC', boxSizing: 'border-box', fontFamily: 'inherit' }} />
          </div>
        </div>

        {/* Start immediately checkbox */}
        <label
          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '6px 0', userSelect: 'none' }}
          onClick={() => setForm(f => ({ ...f, startNow: !f.startNow }))}
        >
          <div style={{
            width: 20, height: 20, borderRadius: 5,
            border: `2px solid ${form.startNow ? ACCENT : '#CBD5E1'}`,
            background: form.startNow ? ACCENT : '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s ease', flexShrink: 0,
          }}>
            {form.startNow && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1 }}>✓</span>}
          </div>
          <span style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 500 }}>
            Start immediately
            <span style={{ color: '#94A3B8', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>
              (set status to WIP instead of To Do)
            </span>
          </span>
        </label>

        <Btn variant="primary" onClick={handleCreate} disabled={!form.title || !form.department}>Create Task</Btn>
      </div>
    </Modal>
  )
}
