import { useState, useEffect, useMemo } from 'react'
import { DEPTS, isStaff } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import { getProjectStartDate, setProjectStartDate, getProjectEndDate, setProjectEndDate } from '../../lib/supabase'
import Fade from '../ui/Fade'
import Card from '../ui/Card'
import Av from '../ui/Av'
import Modal from '../ui/Modal'
import StatusBadge from '../ui/StatusBadge'

export default function ActivityTrackerPage({ tasks, profiles, user, onNavigate }) {
  const isMobile = useIsMobile()
  const [days, setDays] = useState(14)
  const [selectedCell, setSelectedCell] = useState(null)
  const [projectStart, setProjectStart] = useState('')
  const [projectEnd, setProjectEnd] = useState('')
  const [savingStart, setSavingStart] = useState(false)
  const [savingEnd, setSavingEnd] = useState(false)

  // Load project dates on mount
  useEffect(() => {
    getProjectStartDate().then(v => { if (v) setProjectStart(v) })
    getProjectEndDate().then(v => { if (v) setProjectEnd(v) })
  }, [])

  const handleStartDateChange = async (e) => {
    const val = e.target.value
    setProjectStart(val)
    setSavingStart(true)
    await setProjectStartDate(val)
    setSavingStart(false)
  }

  const handleEndDateChange = async (e) => {
    const val = e.target.value
    setProjectEnd(val)
    setSavingEnd(true)
    await setProjectEndDate(val)
    setSavingEnd(false)
  }

  const students = profiles.filter(p => p.role === 'studente')

  const dates = useMemo(() => {
    const today = new Date()
    const all = Array.from({ length: days }, (_, i) => {
      const d = new Date(today)
      d.setDate(d.getDate() - (days - 1 - i))
      return d.toISOString().split('T')[0]
    })
    // Filter out dates before project start
    if (projectStart) return all.filter(d => d >= projectStart)
    return all
  }, [days, projectStart])

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
    green: { bg: '#A7F3D0', border: '#05966950' },
    yellow: { bg: '#FDE68A', border: '#D9770650' },
    red: { bg: '#FECACA', border: '#DC262650' },
  }

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: isMobile ? 16 : 28, gap: isMobile ? 12 : 0 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a2e' }}>Student Activity</h1>
            <p style={{ fontSize: 14, color: '#64748B' }}>Daily monitor</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flexWrap: 'wrap' }}>
            {/* Project start date — staff only */}
            {user && isStaff(user.role) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>Project start:</label>
                <input
                  type="date"
                  value={projectStart}
                  onChange={handleStartDateChange}
                  style={{
                    padding: '5px 10px', borderRadius: 8, fontSize: 12,
                    border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#1a1a2e',
                    outline: 'none', cursor: 'pointer',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(108,92,231,0.4)'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                />
                {savingStart && <span style={{ fontSize: 10, color: '#94A3B8' }}>...</span>}
                {projectStart && (
                  <button
                    onClick={() => { setProjectStart(''); setProjectStartDate('') }}
                    title="Remove start date"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 14, color: '#94A3B8', padding: '2px 4px', lineHeight: 1,
                    }}
                  >✕</button>
                )}
              </div>
            )}
            {user && isStaff(user.role) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>Project end:</label>
                <input
                  type="date"
                  value={projectEnd}
                  onChange={handleEndDateChange}
                  style={{
                    padding: '5px 10px', borderRadius: 8, fontSize: 12,
                    border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#1a1a2e',
                    outline: 'none', cursor: 'pointer',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(108,92,231,0.4)'}
                  onBlur={e => e.target.style.borderColor = '#E2E8F0'}
                />
                {savingEnd && <span style={{ fontSize: 10, color: '#94A3B8' }}>...</span>}
                {projectEnd && (
                  <button
                    onClick={() => { setProjectEnd(''); setProjectEndDate('') }}
                    title="Remove end date"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 14, color: '#94A3B8', padding: '2px 4px', lineHeight: 1,
                    }}
                  >✕</button>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {[7, 14, 21, 30].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: days === d ? 600 : 400,
                    background: days === d ? 'rgba(108,92,231,0.08)' : '#F1F5F9',
                    color: days === d ? '#6C5CE7' : '#64748B',
                    border: `1px solid ${days === d ? 'rgba(108,92,231,0.15)' : '#E2E8F0'}`,
                    cursor: 'pointer', transition: 'all 0.12s ease',
                  }}>{d}g</button>
              ))}
            </div>
          </div>
        </div>
      </Fade>

      {/* Legend */}
      <Fade delay={50}>
        <div style={{ display: 'flex', gap: 20, marginBottom: 20 }}>
          {[
            { bg: '#A7F3D0', border: '#05966950', label: 'Approved' },
            { bg: '#FDE68A', border: '#D9770650', label: 'In Review' },
            { bg: '#FECACA', border: '#DC262650', label: 'No activity' },
          ].map(l => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: l.bg, border: `1.5px solid ${l.border}` }} />
              <span style={{ fontSize: 12, color: '#64748B' }}>{l.label}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>Idle</span>
            <span style={{ fontSize: 12, color: '#64748B' }}>(no tasks assigned)</span>
          </div>
        </div>
      </Fade>

      {/* Table */}
      <Fade delay={100}>
        <div style={{ overflowX: 'auto', borderRadius: 16, border: '1px solid #E8ECF1', background: '#fff' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: dates.length * 44 + 200 }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748B', position: 'sticky', left: 0, background: '#F8FAFC', zIndex: 2, minWidth: 180 }}>
                  Student
                </th>
                {dates.map(d => {
                  const date = new Date(d)
                  const isToday = d === new Date().toISOString().split('T')[0]
                  return (
                    <th key={d} style={{
                      padding: '8px 4px', textAlign: 'center', fontSize: 10,
                      color: isToday ? '#6C5CE7' : '#94A3B8', fontWeight: isToday ? 700 : 400,
                      background: isToday ? 'rgba(108,92,231,0.03)' : 'transparent',
                      minWidth: 40,
                    }}>
                      <div>{date.getDate()}</div>
                      <div style={{ fontSize: 8, textTransform: 'uppercase' }}>{date.toLocaleDateString('en', { weekday: 'short' })}</div>
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
                  <tr key={student.id} style={{ borderTop: '1px solid #E8ECF1' }}>
                    <td style={{
                      padding: '10px 16px', position: 'sticky', left: 0,
                      background: '#fff', zIndex: 1,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Av name={student.full_name} size={26} url={student.avatar_url} mood={student.mood_emoji} />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: '#1a1a2e' }}>{student.full_name}</div>
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>{dept?.label || 'N/A'}</div>
                        </div>
                        {!hasTasks && <span title="No tasks assigned" style={{ fontSize: 11, marginLeft: 4, color: '#94A3B8', fontWeight: 500 }}>Idle</span>}
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
                            background: isToday ? 'rgba(108,92,231,0.03)' : 'transparent',
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
          title={`${selectedCell.student.full_name} — ${new Date(selectedCell.date).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })}`}>
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#64748B' }}>Tasks updated on this date</h3>
            {(() => {
              const dayTasks = getStudentTasksForDay(selectedCell.student.id, selectedCell.date)
              const activeTasks = getStudentActiveTasks(selectedCell.student.id)
              return (
                <>
                  {dayTasks.length === 0 ? (
                    <div style={{ fontSize: 13, color: '#94A3B8', padding: 16, textAlign: 'center' }}>No activity on this date</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                      {dayTasks.map(t => {
                        const dept = DEPTS.find(d => d.id === t.department)
                        return (
                          <div key={t.id} style={{ padding: '10px 14px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E8ECF1', display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{t.title}</div>
                              {t.description && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{t.description}</div>}
                            </div>
                            <StatusBadge status={t.status} type="task" />
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {activeTasks.length > 0 && (
                    <>
                      <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: '#64748B', borderTop: '1px solid #E8ECF1', paddingTop: 16 }}>Student active tasks</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {activeTasks.map(t => {
                          const dept = DEPTS.find(d => d.id === t.department)
                          return (
                            <div key={t.id} style={{ padding: '10px 14px', borderRadius: 10, background: '#F8FAFC', border: '1px solid #E8ECF1', display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{t.title}</div>
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
