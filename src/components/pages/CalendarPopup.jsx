import { useState } from 'react'
import { isStaff } from '../../lib/constants'
import Card from '../ui/Card'
import Btn from '../ui/Btn'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import { IconCheck, IconX } from '../ui/Icons'

export default function CalendarPopup({ events, user, onCreate, onDelete, requestConfirm }) {
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title: '', event_date: '', event_time: '', is_milestone: false, description: '' })
  const staff = isStaff(user.role)

  const handleCreate = async () => {
    if (!form.title || !form.event_date) return
    await onCreate({ ...form, created_by: user.id, event_time: form.event_time || null })
    setForm({ title: '', event_date: '', event_time: '', is_milestone: false, description: '' })
    setShowCreate(false)
  }

  const handleDelete = (ev) => {
    requestConfirm(`Delete "${ev.title}"?`, () => onDelete(ev.id))
  }

  const milestones = events.filter(e => e.is_milestone)
  const upcoming = events.filter(e => !e.is_milestone && new Date(e.event_date) >= new Date(new Date().toDateString()))

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>Calendar</h2>
        {staff && <Btn variant="primary" onClick={() => setShowCreate(true)} style={{ padding: '6px 14px', fontSize: 12 }}>+ Event</Btn>}
      </div>

      {/* Milestones */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#64748B' }}>Milestones</h3>
        {milestones.length === 0 ? <span style={{ color: '#94A3B8', fontSize: 12 }}>No milestones</span> : (
          <div style={{ position: 'relative', paddingLeft: 24 }}>
            <div style={{ position: 'absolute', left: 8, top: 6, bottom: 6, width: 1.5, background: '#E8ECF1', borderRadius: 1 }} />
            {milestones.map((ms, i) => {
              const past = new Date(ms.event_date) < new Date()
              return (
                <div key={ms.id} style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: i < milestones.length - 1 ? 18 : 0, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: -20, width: 14, height: 14, borderRadius: '50%', zIndex: 1,
                    background: past ? '#10B981' : '#F1F5F9', border: past ? '2px solid rgba(16,185,129,0.3)' : '2px solid #E2E8F0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: '#fff',
                  }}>{past ? <IconCheck size={8} color="#fff" /> : ''}</div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: past ? '#10B981' : '#1a1a1a' }}>{ms.title}</span>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(ms.event_date).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</span>
                  {staff && <button onClick={() => handleDelete(ms)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', opacity: 0.4, display: 'flex', alignItems: 'center' }}><IconX size={14} /></button>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upcoming */}
      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, color: '#64748B' }}>Upcoming Events</h3>
      {upcoming.length === 0 ? (
        <span style={{ color: '#94A3B8', fontSize: 12 }}>No upcoming events</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {upcoming.map(ev => (
            <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, background: '#F8FAFC' }}>
              <div style={{
                width: 40, height: 40, borderRadius: 8, background: '#F1F5F9',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#F28C28' }}>{new Date(ev.event_date).getDate()}</span>
                <span style={{ fontSize: 8, color: '#64748B', textTransform: 'uppercase' }}>{new Date(ev.event_date).toLocaleDateString('en', { month: 'short' })}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{ev.title}</div>
                {ev.event_time && <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{ev.event_time.slice(0, 5)}</div>}
              </div>
              {staff && <button onClick={() => handleDelete(ev)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', opacity: 0.4, display: 'flex', alignItems: 'center' }}><IconX size={14} /></button>}
            </div>
          ))}
        </div>
      )}

      {/* Create */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Event">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Event title" />
          <Input value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Description (optional)" />
          <div style={{ display: 'flex', gap: 10 }}>
            <Input type="date" value={form.event_date} onChange={v => setForm(f => ({ ...f, event_date: v }))} style={{ flex: 1 }} />
            <Input type="time" value={form.event_time} onChange={v => setForm(f => ({ ...f, event_time: v }))} style={{ flex: 1 }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748B', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_milestone} onChange={e => setForm(f => ({ ...f, is_milestone: e.target.checked }))} />
            Milestone
          </label>
          <Btn variant="primary" onClick={handleCreate} disabled={!form.title || !form.event_date}>Create</Btn>
        </div>
      </Modal>
    </div>
  )
}
