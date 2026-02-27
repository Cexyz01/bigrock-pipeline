import React, { useState, useCallback, useRef } from 'react'
import { DEPTS } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import ShotCell from './ShotCell'

const arrowBtnStyle = {
  background: 'none', border: 'none', padding: '0 2px',
  fontSize: 10, cursor: 'pointer', color: '#94A3B8',
  lineHeight: 1, transition: 'color 0.15s ease',
}

const iconBtnStyle = {
  background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', opacity: 0.5, padding: 4,
  transition: 'opacity 0.15s ease',
}

const ShotRow = React.memo(function ShotRow({ shot, staff, onCycle, onDelete, onMove, onUploadReference, isFirst, isLast, requestConfirm }) {
  const isMobile = useIsMobile()
  const [h, setH] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const handleDelete = useCallback(() => {
    requestConfirm(`Delete shot ${shot.code}?`, () => onDelete(shot.id))
  }, [shot.id, shot.code, onDelete, requestConfirm])

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file || !onUploadReference) return
    if (file.size > 5 * 1024 * 1024) return // Max 5MB
    setUploading(true)
    try {
      await onUploadReference(shot.id, file)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [shot.id, onUploadReference])

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'grid', gridTemplateColumns: isMobile ? '140px repeat(6, 64px)' : '200px repeat(6, 80px)', gap: 3,
        padding: '10px 0', borderRadius: 8, minWidth: isMobile ? 'max-content' : undefined,
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
              title="Move up"
            >▲</button>
            <button
              onClick={() => onMove?.(shot.id, 'down')}
              disabled={isLast}
              style={{ ...arrowBtnStyle, opacity: isLast ? 0.2 : 0.7 }}
              onMouseEnter={e => { if (!isLast) e.currentTarget.style.color = '#6C5CE7' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8' }}
              title="Move down"
            >▼</button>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{shot.code}</span>
            {shot.concept_image_url && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6C5CE7', flexShrink: 0 }} title="Reference uploaded" />
            )}
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shot.description}</div>
        </div>
        {/* Staff action buttons — visible on hover */}
        {staff && h && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Reference image upload */}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ ...iconBtnStyle, color: '#6C5CE7', opacity: uploading ? 0.3 : 0.5 }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.5' }}
              title="Upload reference image"
            >{uploading ? '⏳' : '🖼️'}</button>
            {/* Delete */}
            <button onClick={handleDelete}
              style={{ ...iconBtnStyle, color: '#EF4444' }}
              onMouseEnter={e => { e.currentTarget.style.opacity = '1' }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '0.5' }}
            >🗑</button>
          </div>
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
  if (prev.shot.concept_image_url !== next.shot.concept_image_url) return false
  for (const d of DEPTS) {
    if (prev.shot[`status_${d.id}`] !== next.shot[`status_${d.id}`]) return false
  }
  return true
})

export default ShotRow
