import React, { useCallback } from 'react'
import { getShotStatus } from '../../lib/constants'

const ShotCell = React.memo(function ShotCell({ status, onClick, clickable }) {
  const st = getShotStatus(status)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3px 2px' }}>
      <div
        className={`shot-cell-inner ${clickable ? 'shot-cell-clickable' : ''}`}
        onClick={clickable ? onClick : undefined}
        style={{
          width: '100%', height: 40, borderRadius: 8,
          background: st.bg,
          border: `1px solid ${st.color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
      >
        {status === 'approved' && <span style={{ fontSize: 14, color: st.color }}>✓</span>}
        {status === 'in_progress' && <div style={{ width: 7, height: 7, borderRadius: '50%', background: st.color, boxShadow: `0 0 6px ${st.color}55` }} />}
        {status === 'review' && <span style={{ fontSize: 12, color: st.color, fontWeight: 700 }}>?</span>}
        {status === 'needs_revision' && <span style={{ fontSize: 12, color: st.color }}>↺</span>}
      </div>
    </div>
  )
})

export default ShotCell
