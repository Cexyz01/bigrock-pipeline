import React, { useState, useCallback, useRef } from 'react'
import { SHOT_DEPTS as DEPTS, ACCENT, isDeptEnabled, isVideoUrl } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import ShotCell from './ShotCell'
import { IconEdit, IconCheck, IconX, IconTrash, IconImage } from '../ui/Icons'

const iconBtnStyle = {
  background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', opacity: 0.5, padding: 4,
  transition: 'opacity 0.15s ease',
}

const GRID_COLS = isMobile => isMobile ? `2.2fr repeat(${DEPTS.length}, 1fr)` : `minmax(220px, 1.5fr) repeat(${DEPTS.length}, minmax(80px, 1fr)) 64px`

// Cloudinary thumbnail transform
const thumbUrl = (url, w = 56, h = 56) => {
  if (!url) return null
  const idx = url.indexOf('/upload/')
  if (idx === -1) return url
  return url.slice(0, idx + 8) + `c_fill,w_${w},h_${h},f_auto/` + url.slice(idx + 8)
}

// Bigger preview transform
const previewUrl = (url) => {
  if (!url) return null
  const idx = url.indexOf('/upload/')
  if (idx === -1) return url
  return url.slice(0, idx + 8) + 'c_fit,w_400,h_260,f_auto/' + url.slice(idx + 8)
}

const ShotRow = React.memo(function ShotRow({ shot, staff, onCycle, onDelete, onUploadReference, onUploadOutput, onUpdateShot, onDragStart, onDragOver, onDrop, requestConfirm, canEditShots, onGoToTasks, sequences = [] }) {
  const isMobile = useIsMobile()
  const [h, setH] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingOutput, setUploadingOutput] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editCode, setEditCode] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editSequence, setEditSequence] = useState('')
  const [editDisabledDepts, setEditDisabledDepts] = useState({})
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)
  const outputFileRef = useRef(null)

  const handleDelete = useCallback(() => {
    requestConfirm(`Eliminare lo shot ${shot.code}?`, () => onDelete(shot.id))
  }, [shot.id, shot.code, onDelete, requestConfirm])

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file || !onUploadReference) return
    if (file.size > 5 * 1024 * 1024) return
    setUploading(true)
    try { await onUploadReference(shot.id, file) } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }, [shot.id, onUploadReference])

  const handleOutputSelect = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file || !onUploadOutput) return
    if (file.size > 30 * 1024 * 1024) return
    setUploadingOutput(true)
    try { await onUploadOutput(shot.id, file) } finally { setUploadingOutput(false); if (outputFileRef.current) outputFileRef.current.value = '' }
  }, [shot.id, onUploadOutput])

  const startEditing = useCallback(() => {
    setEditCode(shot.code || '')
    setEditDesc(shot.description || '')
    setEditSequence(shot.sequence || '')
    setEditDisabledDepts(shot.disabled_depts || {})
    setEditing(true)
  }, [shot.code, shot.description, shot.sequence, shot.disabled_depts])

  const cancelEditing = useCallback(() => setEditing(false), [])

  const toggleDept = useCallback((deptId) => {
    setEditDisabledDepts(prev => {
      const next = { ...prev }
      if (next[deptId]) { delete next[deptId] } else { next[deptId] = true }
      return next
    })
  }, [])

  const saveEditing = useCallback(async () => {
    if (!editCode.trim()) return
    const updates = {}
    if (editCode.trim() !== shot.code) updates.code = editCode.trim()
    if (editDesc !== (shot.description || '')) updates.description = editDesc
    if (editSequence.trim() && editSequence.trim() !== shot.sequence) updates.sequence = editSequence.trim()
    const prevDD = JSON.stringify(shot.disabled_depts || {})
    const newDD = JSON.stringify(editDisabledDepts)
    if (prevDD !== newDD) updates.disabled_depts = editDisabledDepts
    if (Object.keys(updates).length === 0) { setEditing(false); return }
    setSaving(true)
    try { await onUpdateShot(shot.id, updates); setEditing(false) } finally { setSaving(false) }
  }, [editCode, editDesc, editSequence, editDisabledDepts, shot.id, shot.code, shot.description, shot.sequence, shot.disabled_depts, onUpdateShot])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) saveEditing()
    if (e.key === 'Escape') cancelEditing()
  }, [saveEditing, cancelEditing])

  // Drag handlers
  const handleDragStart = useCallback((e) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', shot.id)
    onDragStart?.(shot.id)
  }, [shot.id, onDragStart])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
    onDragOver?.(shot.id)
  }, [shot.id, onDragOver])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const handleDropCb = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const draggedId = e.dataTransfer.getData('text/plain')
    if (draggedId && draggedId !== shot.id) {
      onDrop?.(draggedId, shot.id)
    }
  }, [shot.id, onDrop])

  if (editing) {
    const refImg = shot.ref_cloud_url || shot.concept_image_url
    const outImg = shot.output_cloud_url
    return (
      <div style={{
        padding: isMobile ? 10 : 16, borderRadius: 10,
        background: 'rgba(242,140,40,0.04)', border: `1px solid ${ACCENT}30`,
        margin: '4px 0',
      }}>
        {/* Top row: code + sequence + description */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={editCode} onChange={e => setEditCode(e.target.value)} onKeyDown={handleKeyDown} placeholder="Shot code" autoFocus
            style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', border: '1px solid #E2E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: '#fff', width: 140 }} />
          <input
            list={`seq-list-${shot.id}`}
            value={editSequence}
            onChange={e => setEditSequence(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Sequenza"
            style={{ fontSize: 12, fontWeight: 600, color: '#475569', border: '1px solid #E2E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: '#fff', width: 120 }}
          />
          <datalist id={`seq-list-${shot.id}`}>
            {sequences.map(s => <option key={s} value={s} />)}
          </datalist>
          <input value={editDesc} onChange={e => setEditDesc(e.target.value)} onKeyDown={handleKeyDown} placeholder="Description"
            style={{ fontSize: 12, color: '#475569', border: '1px solid #E2E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: '#fff', flex: 1, minWidth: 180, fontFamily: 'inherit' }} />
        </div>

        {/* Department toggles — horizontal squares */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Departments</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {DEPTS.map(d => {
              const enabled = !editDisabledDepts[d.id]
              return (
                <button key={d.id} onClick={() => toggleDept(d.id)} title={d.label} style={{
                  width: 64, height: 28, borderRadius: 6, fontSize: 9, fontWeight: 600, cursor: 'pointer',
                  border: `2px solid ${enabled ? d.color : '#CBD5E1'}`,
                  background: enabled ? `${d.color}25` : '#F1F5F9',
                  color: enabled ? d.color : '#B0B8C4',
                  transition: 'all 0.15s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                  textTransform: 'uppercase', letterSpacing: '0.02em',
                }}>
                  {enabled && <span style={{ fontSize: 11 }}>✓</span>}
                  {isMobile ? d.label.slice(0, 4) : d.label.length > 8 ? d.label.slice(0, 7) + '.' : d.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Reference & Output previews */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          {/* Reference */}
          <div style={{ flex: '1 1 180px', minWidth: 160 }}>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Reference</div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />
            {refImg ? (
              <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #E2E8F0', background: '#000' }}>
                <img src={previewUrl(refImg)} alt="Reference" style={{ width: '100%', height: 140, objectFit: 'contain', display: 'block' }} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <IconImage size={11} /> {uploading ? '...' : 'Cambia'}
                </button>
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()} style={{
                height: 140, borderRadius: 8, border: '2px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#94A3B8', fontSize: 11, transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#CBD5E1'}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconImage size={14} /> {uploading ? 'Caricamento...' : 'Carica reference'}</span>
              </div>
            )}
          </div>

          {/* Output */}
          <div style={{ flex: '1 1 180px', minWidth: 160 }}>
            <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Output</div>
            <input ref={outputFileRef} type="file" accept="image/*,video/*" onChange={handleOutputSelect} style={{ display: 'none' }} />
            {outImg ? (
              <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid #E2E8F0', background: '#000' }}>
                {isVideoUrl(outImg) ? (
                  <video src={outImg} style={{ width: '100%', height: 140, objectFit: 'contain', display: 'block' }} controls muted />
                ) : (
                  <img src={previewUrl(outImg)} alt="Output" style={{ width: '100%', height: 140, objectFit: 'contain', display: 'block' }} />
                )}
                <button onClick={() => outputFileRef.current?.click()} disabled={uploadingOutput}
                  style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <IconImage size={11} /> {uploadingOutput ? '...' : 'Cambia'}
                </button>
              </div>
            ) : (
              <div onClick={() => outputFileRef.current?.click()} style={{
                height: 140, borderRadius: 8, border: '2px dashed #CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#94A3B8', fontSize: 11, transition: 'border-color 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#8B5CF6'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#CBD5E1'}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  {uploadingOutput ? 'Caricamento...' : 'Carica output'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Bottom actions: Save, Cancel, Delete */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={saveEditing} disabled={saving || !editCode.trim()} style={{
            background: ACCENT, color: '#fff', border: 'none', borderRadius: 6,
            padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            opacity: saving ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 4,
          }}><IconCheck size={12} /> Salva</button>
          <button onClick={cancelEditing} style={{
            background: '#E2E8F0', color: '#475569', border: 'none', borderRadius: 6,
            padding: '5px 14px', fontSize: 11, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}><IconX size={12} /> Annulla</button>
          <div style={{ flex: 1 }} />
          <button onClick={handleDelete} style={{
            background: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: 6,
            padding: '5px 14px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
          }}><IconTrash size={12} /> Elimina Shot</button>
        </div>
      </div>
    )
  }

  const refThumb = thumbUrl(shot.ref_cloud_url || shot.concept_image_url)

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onDragOver={staff && canEditShots ? handleDragOver : undefined}
      onDragLeave={staff && canEditShots ? handleDragLeave : undefined}
      onDrop={staff && canEditShots ? handleDropCb : undefined}
      style={{
        display: 'grid', gridTemplateColumns: GRID_COLS(isMobile), gap: isMobile ? 2 : 3,
        padding: isMobile ? '6px 0' : '10px 0', borderRadius: 8,
        background: dragOver ? 'rgba(242,140,40,0.08)' : h ? '#F8FAFC' : 'transparent',
        borderTop: dragOver ? `2px solid ${ACCENT}` : '2px solid transparent',
        transition: 'background 0.12s ease',
      }}
    >
      <div style={{ paddingLeft: isMobile ? 4 : 8, display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8, minWidth: 0, overflow: 'hidden' }}>
        {/* Drag handle */}
        {staff && canEditShots && !isMobile && (
          <div
            draggable
            onDragStart={handleDragStart}
            style={{
              minWidth: 16, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 2, cursor: 'grab', opacity: h ? 0.5 : 0, transition: 'opacity 0.12s ease',
              padding: '4px 2px',
            }}
            title="Drag to reorder"
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 4px)', gap: 2 }}>
              {[0,1,2,3,4,5].map(i => (
                <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#94A3B8' }} />
              ))}
            </div>
          </div>
        )}

        {/* Reference thumbnail */}
        {refThumb && !isMobile && (
          <img src={refThumb} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }} />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 3 : 6 }}>
            <span style={{ fontSize: isMobile ? 11 : 14, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shot.code}</span>
          </div>
          {!isMobile && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shot.description}</div>}
        </div>
        {/* Edit button on hover */}
        {h && !isMobile && staff && canEditShots && (
          <button onClick={startEditing} style={{ ...iconBtnStyle, color: '#2563EB' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1' }} onMouseLeave={e => { e.currentTarget.style.opacity = '0.5' }}
            title="Modifica shot"><IconEdit size={14} /></button>
        )}
      </div>
      {DEPTS.map(dept => (
        <ShotCell
          key={dept.id}
          status={shot[`status_${dept.id}`]}
          onClick={() => onCycle(shot, dept.id)}
          clickable={staff && isDeptEnabled(shot, dept.id)}
          disabled={!isDeptEnabled(shot, dept.id)}
        />
      ))}
      {/* Tasks link — last grid column */}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {onGoToTasks && (
            <button onClick={() => onGoToTasks(shot.id)} style={{
              background: 'none', border: 'none', fontSize: 10, cursor: 'pointer',
              padding: '2px 4px', borderRadius: 4, color: '#94A3B8', fontWeight: 500, whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = '#2563EB' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94A3B8' }}
            >Tasks →</button>
          )}
        </div>
      )}
    </div>
  )
}, (prev, next) => {
  if (prev.staff !== next.staff) return false
  if (prev.canEditShots !== next.canEditShots) return false
  if (prev.shot.id !== next.shot.id) return false
  if (prev.shot.sort_order !== next.shot.sort_order) return false
  if (prev.shot.code !== next.shot.code) return false
  if (prev.shot.sequence !== next.shot.sequence) return false
  if (prev.shot.description !== next.shot.description) return false
  if (prev.shot.concept_image_url !== next.shot.concept_image_url) return false
  if (prev.shot.ref_cloud_url !== next.shot.ref_cloud_url) return false
  if (prev.shot.output_cloud_url !== next.shot.output_cloud_url) return false
  if (JSON.stringify(prev.shot.disabled_depts) !== JSON.stringify(next.shot.disabled_depts)) return false
  for (const d of DEPTS) {
    if (prev.shot[`status_${d.id}`] !== next.shot[`status_${d.id}`]) return false
  }
  return true
})

export default ShotRow
