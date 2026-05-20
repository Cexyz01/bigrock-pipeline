import React from 'react'
import { getShotStatus } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'

const ShotCell = React.memo(function ShotCell({ status, disabled, onClick, title }) {
  const isMobile = useIsMobile()
  const st = getShotStatus(status)
  const [h, setH] = React.useState(false)

  if (disabled) {
    return (
      <div style={{ padding: isMobile ? '1px 1px' : '3px 2px' }} />
    )
  }

  const clickable = !!onClick

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '1px 1px' : '3px 2px' }}>
      <div
        onClick={clickable ? onClick : undefined}
        onMouseEnter={clickable ? () => setH(true) : undefined}
        onMouseLeave={clickable ? () => setH(false) : undefined}
        title={title}
        style={{
          width: '100%',
          ...(isMobile ? { aspectRatio: '1 / 1' } : { height: 40 }),
          borderRadius: isMobile ? 6 : 8,
          background: st.bg,
          border: `${isMobile ? '1px' : '1.5px'} solid ${h ? st.color : `${st.color}50`}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
          cursor: clickable ? 'pointer' : 'default',
          transform: h ? 'scale(1.04)' : 'none',
          transition: 'transform 0.12s ease, border-color 0.12s ease',
        }}
      >
        {status === 'approved' && <span style={{ fontSize: isMobile ? 11 : 14, color: st.color, fontWeight: 700 }}>✓</span>}
        {status === 'in_progress' && <div style={{ width: isMobile ? 6 : 8, height: isMobile ? 6 : 8, borderRadius: '50%', background: '#2563EB', boxShadow: `0 0 ${isMobile ? 4 : 8}px #2563EB88` }} />}
      </div>
    </div>
  )
})

export default ShotCell
