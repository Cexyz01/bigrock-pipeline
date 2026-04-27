import { useMemo, useState } from 'react'
import { DEPTS, ACCENT } from '../../lib/constants'

// Reusable assignee multi-picker for tasks.
// Groups students by their profile department. The dept matching `selectedDept`
// is rendered first. Includes a search filter for large rosters.
export default function AssigneePicker({ students, selectedIds, onToggle, selectedDept, accent = ACCENT, compact = false }) {
  const [search, setSearch] = useState('')

  const groups = useMemo(() => {
    const filtered = search.trim()
      ? students.filter(s => s.full_name?.toLowerCase().includes(search.trim().toLowerCase()))
      : students
    const byDept = {}
    const NO_DEPT = '__none__'
    for (const s of filtered) {
      const key = s.department || NO_DEPT
      if (!byDept[key]) byDept[key] = []
      byDept[key].push(s)
    }
    Object.values(byDept).forEach(arr => arr.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')))

    // Order: selectedDept first, then other DEPTS in canonical order, then "no dept"
    const orderedKeys = []
    if (selectedDept && byDept[selectedDept]) orderedKeys.push(selectedDept)
    for (const d of DEPTS) {
      if (d.id === selectedDept) continue
      if (byDept[d.id]) orderedKeys.push(d.id)
    }
    if (byDept[NO_DEPT]) orderedKeys.push(NO_DEPT)

    return orderedKeys.map(key => ({
      key,
      label: key === NO_DEPT ? 'Senza dipartimento' : (DEPTS.find(d => d.id === key)?.label || key),
      color: key === NO_DEPT ? '#94A3B8' : (DEPTS.find(d => d.id === key)?.color || '#94A3B8'),
      isMatch: key === selectedDept,
      students: byDept[key],
    }))
  }, [students, search, selectedDept])

  const totalCount = students.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={`Cerca tra ${totalCount} studenti...`}
        style={{
          padding: '8px 12px', fontSize: 12, border: '1px solid #E2E8F0', borderRadius: 8,
          outline: 'none', background: '#F8FAFC', boxSizing: 'border-box', fontFamily: 'inherit',
        }}
      />
      <div style={{ maxHeight: compact ? 140 : 240, overflowY: 'auto', padding: 4, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {groups.length === 0 && (
          <span style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic', padding: '8px 0' }}>
            {totalCount === 0 ? 'No students available' : 'Nessun risultato'}
          </span>
        )}
        {groups.map(g => (
          <div key={g.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: g.color, flexShrink: 0 }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: g.isMatch ? accent : '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {g.label}{g.isMatch ? ' · selected dept' : ''}
              </span>
              <span style={{ fontSize: 10, color: '#94A3B8' }}>{g.students.length}</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {g.students.map(s => {
                const active = selectedIds.includes(s.id)
                return (
                  <button key={s.id} type="button" onClick={() => onToggle(s.id)} style={{
                    padding: '5px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${active ? accent : '#E2E8F0'}`,
                    background: active ? `${accent}18` : '#fff',
                    color: active ? accent : '#64748B',
                    transition: 'all 0.15s ease',
                  }}>{active ? '✓ ' : ''}{s.full_name}</button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
