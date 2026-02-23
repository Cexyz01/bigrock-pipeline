import { useState, useMemo } from 'react'
import { DEPTS } from '../../lib/constants'
import Fade from '../ui/Fade'
import Card from '../ui/Card'
import Av from '../ui/Av'
import Modal from '../ui/Modal'
import StatusBadge from '../ui/StatusBadge'

export default function ActivityTrackerPage({ tasks, profiles, onNavigate }) {
  const [days, setDays] = useState(14)
  const [selectedCell, setSelectedCell] = useState(null)

  const students = profiles.filter(p => p.role === 'studente')

  const dates = useMemo(() => {
    const today = new Date()
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (days - 1 - i))
      return d.toISOString().split('T')[0]
    })
  }, [days])

  const getStudentDayStatus = (studentId, dateStr) => {
    const dayTasks = tasks.filter(t =>
      t.assigned_to === studentId &&
      t.updated_at?.startsWith(dateStr)
    )
    if (dayTasks.some(t => t.status === 'approved')) return 'green'
    if (dayTasks.some(t => t.status === 'review')) return 'yellow'
    return 'red'
  }

  const studentHasActiveTasks = (studentId) =>
    tasks.some(t => t.assigned_to === studentId && t.status !== 'approved')

  const studentHasAnyTasks = (studentId) =>
    tasks.some(t => t.assigned_to === studentId)

  const getStudentTasksForDay = (studentId, dateStr) =>
    tasks.filter(t => t.assigned_to === studentId && t.updated_at?.startsWith(dateStr))

  const getStudentActiveTasks = (studentId) =>
    tasks.filter(t => t.assigned_to === studentId && t.status !== 'approved')

  const cellColors = {
    green: { bg: '#6ee7a025', border: '#6ee7a050' },
    yellow: { bg: '#f0c36d25', border: '#f0c36d50' },
    red: { bg: '#f0707015', border: '#f0707025' },
  }

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px' }}>📊 Attivita Studenti</h1>
            <p style={{ fontSize: 14, color: '#666' }}>Monitor giornaliero delle attivita</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[7, 14, 21, 30].map(d => (
              <button key={d} onClick={() => setDays(d)}
                style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: days === d ? 600 : 400,
                  background: days === d ? '#6ea8fe18' : '#1e1e2a',
                  color: days === d ? '#6ea8fe' : '#777',
                  border: `1px solid ${days === d ? '#6ea8fe30' : '#2a2a3a'}`,
                  cursor: 'pointer', transition: 'all 0.12s ease',
                }}>{d}g</button>
            ))}
          </div>
        </div>
      </Fade>

      {/* Legend */}
      <Fade delay={50}>
        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
          {[
            { color: '#6ee7a0', label: 'Approvato' },
            { color: '#f0c36d', label: 'In Review' },
            { color: '#f07070', label: 'Nessuna attivita' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: `${l.color}30`, border: `1px solid ${l.color}50` }} />
              <span style={{ fontSize: 12, color: '#888' }}>{l.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>💤</span>
            <span style={{ fontSize: 12, color: '#888' }}>Idle (nessun task assegnato)</span>
          </div>
        </div>
      </Fade>

      {/* Table */}
      <Fade delay={100}>
        <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid #1e1e2a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: dates.length * 44 + 200 }}>
            <thead>
              <tr style={{ background: '#15151e' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#888', position: 'sticky', left: 0, background: '#15151e', zIndex: 2, minWidth: 180 }}>
                  Studente
                </th>
                {dates.map(d => {
                  const date = new Date(d)
                  const isToday = d === new Date().toISOString().split('T')[0]
                  return (
                    <th key={d} style={{
                      padding: '8px 4px', textAlign: 'center', fontSize: 10,
                      color: isToday ? '#6ea8fe' : '#555', fontWeight: isToday ? 700 : 400,
                      background: isToday ? '#6ea8fe08' : 'transparent',
                      minWidth: 40,
                    }}>
                      <div>{date.getDate()}</div>
                      <div style={{ fontSize: 8, textTransform: 'uppercase' }}>{date.toLocaleDateString('it', { weekday: 'short' })}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {students.map((student, si) => {
                const hasTasks = studentHasAnyTasks(student.id)
                const dept = DEPTS.find(d => d.id === student.department)
                return (
                  <tr key={student.id} style={{ borderTop: '1px solid #1a1a24' }}>
                    <td style={{
                      padding: '10px 16px', position: 'sticky', left: 0,
                      background: '#0e0e14', zIndex: 1,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Av name={student.full_name} size={26} url={student.avatar_url} mood={student.mood_emoji} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{student.full_name}</div>
                          <div style={{ fontSize: 10, color: '#555' }}>{dept?.icon} {dept?.label || 'N/A'}</div>
                        </div>
                        {!hasTasks && <span title="Nessun task assegnato" style={{ fontSize: 14, marginLeft: 4 }}>💤</span>}
                      </div>
                    </td>
                    {dates.map(dateStr => {
                      const status = getStudentDayStatus(student.id, dateStr)
                      const colors = cellColors[status]
                      const isToday = dateStr === new Date().toISOString().split('T')[0]
                      return (
                        <td key={dateStr}
                          onClick={() => setSelectedCell({ student, date: dateStr })}
                          style={{
                            padding: 3, textAlign: 'center', cursor: 'pointer',
                            background: isToday ? '#6ea8fe06' : 'transparent',
                          }}>
                          <div style={{
                            width: '100%', height: 30, borderRadius: 4,
                            background: colors.bg, border: `1px solid ${colors.border}`,
                            transition: 'all 0.1s ease',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.zIndex = '5' }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '0' }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Fade>

      {/* Cell Detail Modal */}
      {selectedCell && (
        <Modal open={true} onClose={() => setSelectedCell(null)}
          title={`${selectedCell.student.full_name} — ${new Date(selectedCell.date).toLocaleDateString('it', { day: 'numeric', month: 'long', year: 'numeric' })}`}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#aaa' }}>Task aggiornati in questa data</h3>
            {(() => {
              const dayTasks = getStudentTasksForDay(selectedCell.student.id, selectedCell.date)
              const activeTasks = getStudentActiveTasks(selectedCell.student.id)
              return (
                <>
                  {dayTasks.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#555', padding: 16, textAlign: 'center' }}>Nessuna attivita in questa data</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {dayTasks.map(t => {
                        const dept = DEPTS.find(d => d.id === t.department)
                        return (
                          <div key={t.id} style={{ padding: '10px 14px', borderRadius: 10, background: '#1a1a24', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 14 }}>{dept?.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
                              {t.description && <div style={{ fontSize: 11, color: '#777', marginTop: 2 }}>{t.description}</div>}
                            </div>
                            <StatusBadge status={t.status} type="task" />
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {activeTasks.length > 0 && (
                    <>
                      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#aaa', borderTop: '1px solid #1e1e2a', paddingTop: 16 }}>Task attivi dello studente</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {activeTasks.map(t => {
                          const dept = DEPTS.find(d => d.id === t.department)
                          return (
                            <div key={t.id} style={{ padding: '10px 14px', borderRadius: 10, background: '#1a1a24', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 14 }}>{dept?.icon}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{t.title}</div>
                              </div>
                              <StatusBadge status={t.status} type="task" />
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </>
              )
            })()}
          </div>
        </Modal>
      )}
    </div>
  )
}
