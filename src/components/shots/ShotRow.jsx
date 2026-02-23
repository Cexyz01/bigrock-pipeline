import React, { useState, useCallback } from 'react'
import { DEPTS } from '../../lib/constants'
import ShotCell from './ShotCell'

const ShotRow = React.memo(function ShotRow({ shot, staff, onCycle, onDelete, requestConfirm }) {
  const [h, setH] = useState(false)

  const handleDelete = useCallback(() => {
    requestConfirm(`Eliminare lo shot ${shot.code}?`, () => onDelete(shot.id))
  }, [shot.id, shot.code, onDelete, requestConfirm])

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'grid', gridTemplateColumns: '200px repeat(6, 80px)', gap: 3,
        padding: '10px 0', borderRadius: 8,
        background: h ? '#13131c' : 'transparent',
        transition: 'background 0.12s ease',
      }}
    >
      <div style={{ paddingLeft: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{shot.code}</span>
          <div style={{ fontSize: 11, color: '#555', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shot.description}</div>
        </div>
        {staff && h && (
          <button onClick={handleDelete}
            style={{ background: 'none', border: 'none', color: '#f07070', fontSize: 12, cursor: 'pointer', opacity: 0.5, padding: 4 }}>🗑</button>
        )}
      </div>
      {DEPTS.map(dept => (
        <ShotCell
          key={dept.id}
          status={shot[`status_${dept.id}`]}
          onClick={() => onCycle(shot, dept.id)}
          clickable={staff}
        />
      ))}
    </div>
  )
}, (prev, next) => {
  if (prev.staff !== next.staff) return false
  if (prev.shot.id !== next.shot.id) return false
  for (const d of DEPTS) {
    if (prev.shot[`status_${d.id}`] !== next.shot[`status_${d.id}`]) return false
  }
  return true
})

export default ShotRow
