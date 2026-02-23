import React from 'react'
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
          border: `1.5px solid ${st.color}50`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
      >
        {status === 'approved' && <span style={{ fontSize: 14, color: st.color, fontWeight: 700 }}>✓</span>}
        {status === 'in_progress' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.color, boxShadow: `0 0 8px ${st.color}88` }} />}
        {status === 'review' && <span style={{ fontSize: 13, color: st.color, fontWeight: 800 }}>?</span>}
        {status === 'needs_revision' && <span style={{ fontSize: 13, color: st.color, fontWeight: 700 }}>↺</span>}
      </div>
    </div>
  )
})

export default ShotCell
