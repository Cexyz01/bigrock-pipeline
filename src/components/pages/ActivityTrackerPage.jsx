import { useState, useEffect, useMemo } from 'react'
import { DEPTS, hasPermission } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import { getAllWipUpdates, updateProject, getProjectMembers } from '../../lib/supabase'
import Fade from '../ui/Fade'
import Card from '../ui/Card'
import Av from '../ui/Av'
import Modal from '../ui/Modal'
import StatusBadge from '../ui/StatusBadge'
import ImageLightbox from '../ui/ImageLightbox'
import { IconX } from '../ui/Icons'
import { cld } from '../../lib/cld'

export default function ActivityTrackerPage({ tasks, profiles, user, onNavigate, currentProject }) {
  const isMobile = useIsMobile()
  const [days, setDays] = useState(14)
  const [selectedCell, setSelectedCell] = useState(null)
  const [projectStart, setProjectStart] = useState(currentProject?.start_date || '')
  const [projectEnd, setProjectEnd] = useState(currentProject?.end_date || '')
  const [savingStart, setSavingStart] = useState(false)
  const [savingEnd, setSavingEnd] = useState(false)
  const [allWips, setAllWips] = useState([])
  const [datesLoaded, setDatesLoaded] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState(null)

  // Load WIP updates on mount
  useEffect(() => {
    getAllWipUpdates().then(setAllWips).then(() => setDatesLoaded(true))
  }, [])

  // Sync dates from currentProject prop
  useEffect(() => {
    if (currentProject) {
      setProjectStart(currentProject.start_date || '')
      setProjectEnd(currentProject.end_date || '')
    }
  }, [currentProject])

  // Refresh WIPs when tasks change (e.g. new WIP pushed)
  useEffect(() => {
    getAllWipUpdates().then(setAllWips)
  }, [tasks])

  const handleStartDateChange = async (e) => {
    const val = e.target.value
    setProjectStart(val)
    if (!currentProject) return
    setSavingStart(true)
    await updateProject(currentProject.id, { start_date: val || null })
    setSavingStart(false)
  }

  const handleEndDateChange = async (e) => {
    const val = e.target.value
    setProjectEnd(val)
    if (!currentProject) return
    setSavingEnd(true)
    await updateProject(currentProject.id, { end_date: val || null })
    setSavingEnd(false)
  }

  const [projectMemberIds, setProjectMemberIds] = useState(null)

  useEffect(() => {
    if (!currentProject) return
    getProjectMembers(currentProject.id).then(members => {
      setProjectMemberIds(new Set(members.map(m => m.user_id)))
    })
  }, [currentProject?.id])

  const students = profiles.filter(p =>
    p.role === 'studente' && (projectMemberIds ? projectMemberIds.has(p.id) : true)
  )

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

  // Index WIPs by student+date for fast lookup
  const wipsByStudentDate = useMemo(() => {
    const map = {}
    for (const wip of allWips) {
      const studentId = wip.user_id
      const dateStr = wip.created_at?.split('T')[0]
      if (!studentId || !dateStr) continue
      const key = `${studentId}_${dateStr}`
      if (!map[key]) map[key] = []
      map[key].push(wip)
    }
    return map
  }, [allWips])

  // Index approved tasks by student+date (using updated_at as the approval date)
  const approvedByStudentDate = useMemo(() => {
    const map = {}
    for (const t of tasks) {
      if (t.status !== 'approved' || !t.assigned_to || !t.updated_at) continue
      const dateStr = t.updated_at.split('T')[0]
      const key = `${t.assigned_to}_${dateStr}`
      if (!map[key]) map[key] = []
      map[key].push(t)
    }
    return map
  }, [tasks])

  const getStudentDayStatus = (studentId, dateStr) => {
    const key = `${studentId}_${dateStr}`
    const dayWips = wipsByStudentDate[key] || []
    const dayApproved = approvedByStudentDate[key] || []

    if (dayApproved.length > 0) return { type: 'green', wipCount: dayWips.length, approvedCount: dayApproved.length }
    if (dayWips.length > 0) return { type: 'blue', wipCount: dayWips.length, approvedCount: 0 }
    return { type: 'red', wipCount: 0, approvedCount: 0 }
  }

  const studentHasAnyTasks = (studentId) =>
    tasks.some(t => t.assigned_to === studentId)

  const cellColors = {
    green: { bg: '#A7F3D0', border: '#05966950', text: '#059669' },
    blue: { bg: '#BFDBFE', border: '#3B82F650', text: '#2563EB' },
    red: { bg: '#FECACA', border: '#DC262650', text: '#DC2626' },
  }

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', marginBottom: isMobile ? 16 : 28, gap: isMobile ? 12 : 0 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' }}>Student Activity</h1>
            <p style={{ fontSize: 14, color: '#64748B' }}>Daily monitor</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, flexWrap: 'wrap' }}>
            {/* Project start date — staff only */}
            {user && hasPermission(user, 'access_activity') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>Project start:</label>
                <input
                  type="date"
                  value={projectStart}
                  onChange={handleStartDateChange}
                  style={{
                    padding: '5px 10px', borderRadius: 8, fontSize: 12,
                    border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#1a1a1a',
                    outline: 'none', cursor: 'pointer',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(242,140,40,0.4)'}
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
                  ><IconX size={14} /></button>
                )}
              </div>
            )}
            {user && hasPermission(user, 'access_activity') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <label style={{ fontSize: 11, color: '#94A3B8', whiteSpace: 'nowrap' }}>Project end:</label>
                <input
                  type="date"
                  value={projectEnd}
                  onChange={handleEndDateChange}
                  style={{
                    padding: '5px 10px', borderRadius: 8, fontSize: 12,
                    border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#1a1a1a',
                    outline: 'none', cursor: 'pointer',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(242,140,40,0.4)'}
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
                  ><IconX size={14} /></button>
                )}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              {[7, 14, 21, 30].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: days === d ? 600 : 400,
                    background: days === d ? 'rgba(242,140,40,0.08)' : '#F1F5F9',
                    color: days === d ? '#F28C28' : '#64748B',
                    border: `1px solid ${days === d ? 'rgba(242,140,40,0.15)' : '#E2E8F0'}`,
                    cursor: 'pointer', transition: 'all 0.12s ease',
                  }}>{d}g</button>
              ))}
            </div>
          </div>
        </div>
      </Fade>

      {/* Legend */}
      <Fade delay={50}>
        <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { bg: '#BFDBFE', border: '#3B82F650', label: 'WIP pushed' },
            { bg: '#A7F3D0', border: '#05966950', label: 'Approved' },
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

      {/* Table — only render after project dates are loaded to avoid flash */}
      {!datesLoaded ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 13 }}>Loading...</div>
      ) : isMobile ? (
        /* ─── MOBILE: card layout, squares below name, horizontally scrollable ─── */
        <Fade delay={100}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {students.map((student) => {
              const hasTasks = studentHasAnyTasks(student.id)
              const dept = DEPTS.find(d => d.id === student.department)
              return (
                <div key={student.id} style={{
                  background: '#fff', borderRadius: 12, border: '1px solid #E8ECF1',
                  padding: '10px 12px', overflow: 'hidden',
                }}>
                  {/* Student name row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Av name={student.full_name} size={26} url={student.avatar_url} mood={student.mood_emoji} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{student.full_name}</div>
                      <div style={{ fontSize: 10, color: '#94A3B8' }}>{dept?.label || 'N/A'}</div>
                    </div>
                    {!hasTasks && <span style={{ fontSize: 10, color: '#94A3B8', fontWeight: 500, whiteSpace: 'nowrap' }}>Idle</span>}
                  </div>
                  {/* Squares row — horizontally scrollable */}
                  <div style={{
                    overflowX: 'auto', overflowY: 'hidden',
                    WebkitOverflowScrolling: 'touch',
                    margin: '0 -4px', padding: '0 4px',
                  }}>
                    <div style={{ display: 'flex', gap: 3, width: 'max-content' }}>
                      {dates.map(dateStr => {
                        const status = getStudentDayStatus(student.id, dateStr)
                        const colors = cellColors[status.type]
                        const date = new Date(dateStr)
                        const isToday = dateStr === new Date().toISOString().split('T')[0]
                        return (
                          <div key={dateStr}
                            onClick={() => setSelectedCell({ student, date: dateStr, status })}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
                          >
                            {/* Date label */}
                            <div style={{
                              fontSize: 8, lineHeight: 1, marginBottom: 2, textAlign: 'center',
                              color: isToday ? '#F28C28' : '#B0B8C4', fontWeight: isToday ? 700 : 400,
                            }}>
                              {date.getDate()}
                            </div>
                            {/* Square */}
                            <div style={{
                              width: 28, height: 28, borderRadius: 4,
                              background: colors.bg, border: `1px solid ${colors.border}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: isToday ? '0 0 0 1.5px #F28C28' : 'none',
                            }}>
                              {status.wipCount > 0 && (
                                <span style={{ fontSize: 9, fontWeight: 700, color: colors.text, lineHeight: 1 }}>
                                  {status.wipCount}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Fade>
      ) : (
        /* ─── DESKTOP: original table layout ─── */
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
                      color: isToday ? '#F28C28' : '#94A3B8', fontWeight: isToday ? 700 : 400,
                      background: isToday ? 'rgba(242,140,40,0.03)' : 'transparent',
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
              {students.map((student) => {
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
                          <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', color: '#1a1a1a' }}>{student.full_name}</div>
                          <div style={{ fontSize: 10, color: '#94A3B8' }}>{dept?.label || 'N/A'}</div>
                        </div>
                        {!hasTasks && <span title="No tasks assigned" style={{ fontSize: 11, marginLeft: 4, color: '#94A3B8', fontWeight: 500 }}>Idle</span>}
                      </div>
                    </td>
                    {dates.map(dateStr => {
                      const status = getStudentDayStatus(student.id, dateStr)
                      const colors = cellColors[status.type]
                      const isToday = dateStr === new Date().toISOString().split('T')[0]
                      return (
                        <td key={dateStr}
                          onClick={() => setSelectedCell({ student, date: dateStr, status })}
                          style={{
                            padding: 3, textAlign: 'center', cursor: 'pointer',
                            background: isToday ? 'rgba(242,140,40,0.03)' : 'transparent',
                          }}>
                          <div style={{
                            width: '100%', height: 30, borderRadius: 4,
                            background: colors.bg, border: `1px solid ${colors.border}`,
                            transition: 'all 0.1s ease',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.15)'; e.currentTarget.style.zIndex = '5' }}
                          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '0' }}
                          >
                            {status.wipCount > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: colors.text, lineHeight: 1 }}>
                                {status.wipCount}
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Fade>)}

      {/* Cell Detail Modal */}
      {selectedCell && (
        <Modal open={true} onClose={() => setSelectedCell(null)}
          title={`${selectedCell.student.full_name} — ${new Date(selectedCell.date).toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' })}`}>
          <CellDetailContent
            student={selectedCell.student}
            dateStr={selectedCell.date}
            wipsByStudentDate={wipsByStudentDate}
            approvedByStudentDate={approvedByStudentDate}
            tasks={tasks}
            onImageClick={setLightboxUrl}
          />
        </Modal>
      )}

      <ImageLightbox src={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  )
}

function WipCard({ wip, green, onImageClick }) {
  const bg = green ? '#D1FAE5' : '#DBEAFE'
  const border = green ? '#A7F3D0' : '#BFDBFE'
  const titleColor = green ? '#065F46' : '#1E40AF'
  const timeColor = green ? '#059669' : '#3B82F6'
  const noteColor = green ? '#047857' : '#1E3A5F'
  const imgBorder = green ? '#6EE7B7' : '#93C5FD'
  return (
    <div style={{ padding: '10px 14px', borderRadius: 10, background: bg, border: `1px solid ${border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: wip.note || (wip.images?.length > 0) ? 6 : 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: titleColor }}>{wip.task?.title || 'Task'}</div>
          <div style={{ fontSize: 10, color: timeColor, marginTop: 1 }}>
            {new Date(wip.created_at).toLocaleTimeString('it', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        {green
          ? <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', background: '#A7F3D0', padding: '2px 8px', borderRadius: 6 }}>Approved</span>
          : <span style={{ fontSize: 11, fontWeight: 600, color: '#2563EB', background: '#BFDBFE', padding: '2px 8px', borderRadius: 6 }}>WIP</span>
        }
      </div>
      {wip.note && <div style={{ fontSize: 12, color: noteColor, marginTop: 2 }}>{wip.note}</div>}
      {wip.images?.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
          {wip.images.map((url, i) => (
            <div key={i} onClick={() => onImageClick?.(url)} style={{ cursor: 'pointer' }}>
              <img src={cld(url, { w: 120, h: 120, fit: 'fill' })} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: `1px solid ${imgBorder}` }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CellDetailContent({ student, dateStr, wipsByStudentDate, approvedByStudentDate, tasks, onImageClick }) {
  const key = `${student.id}_${dateStr}`
  const dayWips = wipsByStudentDate[key] || []
  const dayApproved = approvedByStudentDate[key] || []

  // For each approved task, find its latest WIP from this day
  const approvedTaskIds = new Set(dayApproved.map(t => t.id))
  const approvedWips = []
  const seenTaskIds = new Set()
  // dayWips is already sorted by created_at desc, so first match per task is the latest
  for (const wip of dayWips) {
    if (wip.task_id && approvedTaskIds.has(wip.task_id) && !seenTaskIds.has(wip.task_id)) {
      approvedWips.push(wip)
      seenTaskIds.add(wip.task_id)
    }
  }
  // Remaining WIPs (not belonging to approved tasks) go in the orange section
  const remainingWips = dayWips.filter(w => !approvedTaskIds.has(w.task_id))

  const hasAnything = dayWips.length > 0 || dayApproved.length > 0

  if (!hasAnything) {
    return <div style={{ fontSize: 13, color: '#94A3B8', padding: 16, textAlign: 'center' }}>Nessuna attività in questa giornata</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Approved tasks (green) — show approved task + its latest WIP */}
      {dayApproved.length > 0 && (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: '#059669' }}>Task approvati</h3>
          {dayApproved.map(t => {
            const dept = DEPTS.find(d => d.id === t.department)
            const latestWip = approvedWips.find(w => w.task_id === t.id)
            // If there's a WIP with screenshots, show only that; otherwise show the task info
            if (latestWip) return <WipCard key={t.id} wip={latestWip} green onImageClick={onImageClick} />
            return (
              <div key={t.id} style={{
                padding: '10px 14px', borderRadius: 10,
                background: '#D1FAE5', border: '1px solid #A7F3D0',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#065F46' }}>{t.title}</div>
                  {dept && <div style={{ fontSize: 10, color: '#059669', marginTop: 2 }}>{dept.label}</div>}
                </div>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#059669', background: '#A7F3D0', padding: '2px 8px', borderRadius: 6 }}>Approved</span>
              </div>
            )
          })}
        </>
      )}

      {/* Remaining WIP updates (blue) — only WIPs for non-approved tasks */}
      {remainingWips.length > 0 && (
        <>
          <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, color: '#2563EB', marginTop: dayApproved.length > 0 ? 8 : 0 }}>
            WIP Updates ({remainingWips.length})
          </h3>
          {remainingWips.map(wip => <WipCard key={wip.id} wip={wip} onImageClick={onImageClick} />)}
        </>
      )}
    </div>
  )
}
