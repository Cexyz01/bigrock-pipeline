import { useState } from 'react'
import { DEPTS } from '../../lib/constants'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Select from '../ui/Select'
import Btn from '../ui/Btn'

export default function CreateTaskModal({ open, onClose, shots, students, user, onCreate }) {
  const [form, setForm] = useState({ title: '', description: '', department: '', assigned_to: '', shot_id: '' })

  const handleCreate = async () => {
    if (!form.title || !form.department) return
    await onCreate({
      ...form,
      assigned_to: form.assigned_to || null,
      shot_id: form.shot_id || null,
      created_by: user.id,
    })
    setForm({ title: '', description: '', department: '', assigned_to: '', shot_id: '' })
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
        <Btn variant="primary" onClick={handleCreate} disabled={!form.title || !form.department}>Crea Task</Btn>
      </div>
    </Modal>
  )
}
