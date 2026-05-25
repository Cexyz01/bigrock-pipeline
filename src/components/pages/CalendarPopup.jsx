import { useState, useMemo } from 'react'
import { hasPermission } from '../../lib/constants'
import Btn from '../ui/Btn'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import Calendar from '../ui/Calendar'
import DateInput from '../ui/DateInput'
import { IconCheck, IconX, IconClock } from '../ui/Icons'

const MONTHS_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

const todayYmd = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function CalendarPopup({ events, user, onCreate, onDelete, requestConfirm, noHeader = false }) {
  const [showCreate, setShowCreate] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayYmd())
  const [form, setForm] = useState({ title: '', event_date: '', event_time: '', is_milestone: false, description: '' })
  const staff = hasPermission(user, 'manage_calendar')

  const handleCreate = async () => {
    if (!form.title || !form.event_date) return
    await onCreate({ ...form, created_by: user.id, event_time: form.event_time || null })
    setForm({ title: '', event_date: '', event_time: '', is_milestone: false, description: '' })
    setShowCreate(false)
  }

  const handleDelete = (ev) => {
    requestConfirm(`Eliminare "${ev.title}"?`, () => onDelete(ev.id))
  }

  const openCreateFor = (ymd) => {
    setForm(f => ({ ...f, event_date: ymd || selectedDate }))
    setShowCreate(true)
  }

  const dayEvents = useMemo(
    () => events.filter(e => e.event_date === selectedDate)
      .sort((a, b) => (a.event_time || '').localeCompare(b.event_time || '')),
    [events, selectedDate]
  )

  const milestones = useMemo(
    () => events.filter(e => e.is_milestone).sort((a, b) => a.event_date.localeCompare(b.event_date)),
    [events]
  )

  const selectedLabel = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00')
    return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
  }, [selectedDate])

  return (
    <div>
      {!noHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a' }}>Calendario</h2>
          {staff && <Btn variant="primary" onClick={() => openCreateFor()} style={{ padding: '6px 14px', fontSize: 12 }}>+ Evento</Btn>}
        </div>
      )}
      {noHeader && staff && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <Btn variant="primary" onClick={() => openCreateFor()} style={{ padding: '6px 14px', fontSize: 12 }}>+ Evento</Btn>
        </div>
      )}

      {/* Month grid */}
      <Calendar value={selectedDate} onChange={setSelectedDate} events={events} />

      {/* Selected day events */}
      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.4 }}>{selectedLabel}</h3>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>{dayEvents.length} event{dayEvents.length === 1 ? 'o' : 'i'}</span>
        </div>
        {dayEvents.length === 0 ? (
          <div style={{ padding: '14px 12px', background: '#F8FAFC', borderRadius: 10, fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
            Nessun evento in questo giorno
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {dayEvents.map(ev => (
              <div key={ev.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: '#F8FAFC',
                borderLeft: `3px solid ${ev.is_milestone ? '#F28C28' : '#CBD5E1'}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                  {(ev.event_time || ev.description) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      {ev.event_time && <span style={{ fontSize: 11, color: '#64748B', display: 'inline-flex', alignItems: 'center', gap: 3 }}><IconClock size={10} />{ev.event_time.slice(0, 5)}</span>}
                      {ev.description && <span style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.description}</span>}
                    </div>
                  )}
                </div>
                {staff && (
                  <button onClick={() => handleDelete(ev)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', opacity: 0.5, display: 'flex', alignItems: 'center', padding: 2 }}>
                    <IconX size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Milestones timeline */}
      {milestones.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 10 }}>Milestone</h3>
          <div style={{ position: 'relative', paddingLeft: 22 }}>
            <div style={{ position: 'absolute', left: 6, top: 6, bottom: 6, width: 1.5, background: '#E8ECF1', borderRadius: 1 }} />
            {milestones.map((ms, i) => {
              const past = new Date(ms.event_date) < new Date(new Date().toDateString())
              return (
                <div key={ms.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < milestones.length - 1 ? 14 : 0, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: -19, width: 12, height: 12, borderRadius: '50%', zIndex: 1,
                    background: past ? '#10B981' : '#fff', border: past ? '2px solid rgba(16,185,129,0.3)' : '2px solid #E2E8F0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{past && <IconCheck size={7} color="#fff" />}</div>
                  <button
                    onClick={() => setSelectedDate(ms.event_date)}
                    style={{
                      flex: 1, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                      fontSize: 13, fontWeight: 600, color: past ? '#10B981' : '#1a1a1a',
                    }}
                  >{ms.title}</button>
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(ms.event_date + 'T00:00:00').toLocaleDateString('it', { day: 'numeric', month: 'short' })}</span>
                  {staff && (
                    <button onClick={() => handleDelete(ms)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', opacity: 0.4, display: 'flex', alignItems: 'center' }}>
                      <IconX size={13} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Create */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nuovo evento">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder="Titolo evento" />
          <Input value={form.description} onChange={v => setForm(f => ({ ...f, description: v }))} placeholder="Descrizione (opzionale)" />
          <div style={{ display: 'flex', gap: 10 }}>
            <DateInput value={form.event_date} onChange={v => setForm(f => ({ ...f, event_date: v }))} style={{ flex: 1 }} placeholder="Data" />
            <Input type="time" value={form.event_time} onChange={v => setForm(f => ({ ...f, event_time: v }))} style={{ flex: 1 }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#64748B', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_milestone} onChange={e => setForm(f => ({ ...f, is_milestone: e.target.checked }))} />
            Segna come milestone
          </label>
          <Btn variant="primary" onClick={handleCreate} disabled={!form.title || !form.event_date}>Crea evento</Btn>
        </div>
      </Modal>
    </div>
  )
}
