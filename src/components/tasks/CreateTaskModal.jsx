import { useState } from 'react'
import { DEPTS, ACCENT } from '../../lib/constants'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Btn from '../ui/Btn'

export default function CreateTaskModal({ open, onClose, shots, students, user, onCreate }) {
  const [form, setForm] = useState({ title: '', description: '', department: '', assigned_to: '', shot_id: '', startNow: false })

  const handleCreate = async () => {
    if (!form.title || !form.department) return
    await onCreate({
      title: form.title,
      description: form.description,
      department: form.department,
      assigned_to: form.assigned_to || null,
      shot_id: form.shot_id || null,
      created_by: user.id,
      status: form.startNow ? 'wip' : 'todo',
    })
    setForm({ title: '', description: '', department: '', assigned_to: '', shot_id: '', startNow: false })
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Nuovo Task">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Titolo del task" />
        <Input value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Descrizione (opzionale)" multiline />
        <Select value={form.department} onChange={v => setForm(f => ({ ...f, department: v }))}
          options={DEPTS.map(d => ({ value: d.id, label: d.label }))} placeholder="Seleziona dipartimento" />
        <Select value={form.assigned_to} onChange={v => setForm(f => ({ ...f, assigned_to: v }))}
          options={students.map(s => ({ value: s.id, label: s.full_name }))} placeholder="Assegna a studente (opzionale)" />
        <Select value={form.shot_id} onChange={v => setForm(f => ({ ...f, shot_id: v || null }))}
          options={shots.map(s => ({ value: s.id, label: `${s.code} — ${s.description || s.sequence}` }))} placeholder="Collega a shot (opzionale)" />

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
          <span style={{ fontSize: 13, color: '#1a1a2e', fontWeight: 500 }}>
            Inizia subito
            <span style={{ color: '#94A3B8', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>
              (imposta stato WIP invece di To Do)
            </span>
          </span>
        </label>

        <Btn variant="primary" onClick={handleCreate} disabled={!form.title || !form.department}>Crea Task</Btn>
      </div>
    </Modal>
  )
}
