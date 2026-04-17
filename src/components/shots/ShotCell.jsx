import React from 'react'
import { getShotStatus } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'

const ShotCell = React.memo(function ShotCell({ status, onClick, clickable, disabled }) {
  const isMobile = useIsMobile()
  const st = getShotStatus(status)
  const isComplete = status === 'review'

  if (disabled) {
    return (
      <div style={{ padding: isMobile ? '1px 1px' : '3px 2px' }} />
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '1px 1px' : '3px 2px' }}>
      <div
        className={`shot-cell-inner ${clickable ? 'shot-cell-clickable' : ''}`}
        onClick={clickable ? onClick : undefined}
        style={{
          width: '100%',
          ...(isMobile ? { aspectRatio: '1 / 1' } : { height: 40 }),
          borderRadius: isMobile ? 6 : 8,
          background: st.bg,
          border: `${isComplete ? (isMobile ? '2.5px' : '3px') : (isMobile ? '1px' : '1.5px')} solid ${isComplete ? '#2563EB' : `${st.color}50`}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
      >
        {status === 'approved' && <span style={{ fontSize: isMobile ? 11 : 14, color: st.color, fontWeight: 700 }}>✓</span>}
        {status === 'review' && <span style={{ fontSize: isMobile ? 11 : 14, color: '#059669', fontWeight: 700 }}>✓</span>}
        {status === 'in_progress' && <div style={{ width: isMobile ? 6 : 8, height: isMobile ? 6 : 8, borderRadius: '50%', background: '#2563EB', boxShadow: `0 0 ${isMobile ? 4 : 8}px #2563EB88` }} />}
      </div>
    </div>
  )
})

export default ShotCell
