import { useState, useEffect } from 'react'
import { ACCENT } from '../../lib/constants'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Btn from '../ui/Btn'

const PALETTE = [
  '#F28C28', // accent
  '#2563EB', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#A78BFA', // purple
  '#14B8A6', // teal
  '#E879F9', // pink
  '#64748B', // slate
]

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const addDaysISO = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

export default function GanttItemModal({ open, item, existingLanes = [], onClose, onSave, onDelete, canEdit }) {
  const [form, setForm] = useState(() => ({
    title: '', description: '', lane: existingLanes[0] || 'General',
    start_date: today(), end_date: addDaysISO(today(), 6), color: PALETTE[0],
  }))
  const [saving, setSaving] = useState(false)
  const [showLaneInput, setShowLaneInput] = useState(false)

  useEffect(() => {
    if (item) {
      setForm({
        title: item.title || '',
        description: item.description || '',
        lane: item.lane || 'General',
        start_date: item.start_date || today(),
        end_date: item.end_date || today(),
        color: item.color || PALETTE[0],
      })
    } else {
      setForm({
        title: '', description: '',
        lane: existingLanes[0] || 'General',
        start_date: today(), end_date: addDaysISO(today(), 6), color: PALETTE[0],
      })
    }
    setShowLaneInput(false)
  }, [item, open])

  const handleSubmit = async () => {
    if (!form.title.trim()) return
    if (form.end_date < form.start_date) {
      alert('La data fine deve essere dopo la data inizio')
      return
    }
    setSaving(true)
    await onSave({
      title: form.title.trim(),
      description: form.description.trim() || null,
      lane: form.lane.trim() || 'General',
      start_date: form.start_date,
      end_date: form.end_date,
      color: form.color,
    })
    setSaving(false)
  }

  const inputStyle = {
    width: '100%', fontSize: 13, color: '#1a1a1a', border: '1px solid #E2E8F0',
    borderRadius: 10, padding: '10px 12px', outline: 'none', background: '#F8FAFC',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Modifica elemento' : 'Nuovo elemento'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Input value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Titolo (es. Concept Art Sequenza 1)" />
        <textarea value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Descrizione (opzionale)" rows={3}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />

        {/* Lane selector */}
        <div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>Lane (categoria)</div>
          {showLaneInput ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={form.lane} onChange={e => setForm(f => ({ ...f, lane: e.target.value }))}
                placeholder="Nome nuova lane" autoFocus
                style={inputStyle} />
              <Btn variant="info" onClick={() => setShowLaneInput(false)}>OK</Btn>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {existingLanes.map(l => (
                <button key={l} type="button" onClick={() => setForm(f => ({ ...f, lane: l }))} style={{
                  padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${form.lane === l ? ACCENT : '#E2E8F0'}`,
                  background: form.lane === l ? `${ACCENT}18` : '#fff',
                  color: form.lane === l ? ACCENT : '#64748B', transition: 'all 0.15s ease',
                }}>{l}</button>
              ))}
              <button type="button" onClick={() => setShowLaneInput(true)} style={{
                padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                border: '1.5px dashed #CBD5E1', background: '#fff', color: '#94A3B8',
              }}>+ Nuova lane</button>
            </div>
          )}
        </div>

        {/* Dates */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>Inizio</div>
            <input type="date" value={form.start_date}
              onChange={e => setForm(f => ({ ...f, start_date: e.target.value, end_date: f.end_date < e.target.value ? e.target.value : f.end_date }))}
              style={inputStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>Fine</div>
            <input type="date" value={form.end_date} min={form.start_date}
              onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
              style={inputStyle} />
          </div>
        </div>

        {/* Color */}
        <div>
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>Colore</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {PALETTE.map(c => (
              <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))} style={{
                width: 32, height: 32, borderRadius: 8, cursor: 'pointer',
                background: c, border: form.color === c ? '3px solid #1a1a1a' : '2px solid transparent',
                transition: 'transform 0.15s ease',
                transform: form.color === c ? 'scale(1.08)' : 'none',
              }} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {onDelete && canEdit && (
            <Btn variant="danger" onClick={onDelete} style={{ flexShrink: 0 }}>Elimina</Btn>
          )}
          <Btn variant="primary" onClick={handleSubmit} loading={saving} disabled={!form.title.trim() || !canEdit}
            style={{ flex: 1, justifyContent: 'center' }}>
            {item ? 'Salva' : 'Crea'}
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
