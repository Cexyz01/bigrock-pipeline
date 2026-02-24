import React, { useState, useCallback } from 'react'
import { DEPTS } from '../../lib/constants'
import ShotCell from './ShotCell'

const arrowBtnStyle = {
  background: 'none', border: 'none', padding: '0 2px',
  fontSize: 10, cursor: 'pointer', color: '#94A3B8',
  lineHeight: 1, transition: 'color 0.15s ease',
}

const ShotRow = React.memo(function ShotRow({ shot, staff, onCycle, onDelete, onMove, isFirst, isLast, requestConfirm }) {
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
        background: h ? '#F8FAFC' : 'transparent',
        transition: 'background 0.12s ease',
      }}
    >
      <div style={{ paddingLeft: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Reorder arrows — staff only, always reserve space, visible on hover */}
        {staff && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 16, visibility: h ? 'visible' : 'hidden' }}>
            <button
              onClick={() => onMove?.(shot.id, 'up')}
              disabled={isFirst}
              style={{ ...arrowBtnStyle, opacity: isFirst ? 0.2 : 0.7 }}
              onMouseEnter={e => { if (!isFirst) e.currentTarget.style.color = '#6C5CE7' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8' }}
              title="Sposta su"
            >▲</button>
            <button
              onClick={() => onMove?.(shot.id, 'down')}
              disabled={isLast}
              style={{ ...arrowBtnStyle, opacity: isLast ? 0.2 : 0.7 }}
              onMouseEnter={e => { if (!isLast) e.currentTarget.style.color = '#6C5CE7' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8' }}
              title="Sposta giù"
            >▼</button>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{shot.code}</span>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shot.description}</div>
        </div>
        {staff && h && (
          <button onClick={handleDelete}
            style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer', opacity: 0.5, padding: 4 }}>🗑</button>
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
  if (prev.isFirst !== next.isFirst) return false
  if (prev.isLast !== next.isLast) return false
  if (prev.shot.sort_order !== next.shot.sort_order) return false
  for (const d of DEPTS) {
    if (prev.shot[`status_${d.id}`] !== next.shot[`status_${d.id}`]) return false
  }
  return true
})

export default ShotRow
