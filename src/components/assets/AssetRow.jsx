import React, { useState, useCallback, useRef } from 'react'
import { ASSET_DEPTS, ACCENT, isVideoUrl } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import ShotCell from '../shots/ShotCell'
import { IconEdit, IconCheck, IconX, IconTrash, IconImage } from '../ui/Icons'

const iconBtnStyle = {
  background: 'none', border: 'none', fontSize: 12, cursor: 'pointer', opacity: 0.5, padding: 4,
  transition: 'opacity 0.15s ease',
}

const GRID_COLS = isMobile => isMobile ? `2.2fr repeat(${ASSET_DEPTS.length}, 1fr)` : `280px repeat(${ASSET_DEPTS.length}, 72px) 56px`

const thumbUrl = (url, w = 56, h = 56) => {
  if (!url) return null
  const idx = url.indexOf('/upload/')
  if (idx === -1) return url
  return url.slice(0, idx + 8) + `c_fill,w_${w},h_${h},q_auto,f_auto/` + url.slice(idx + 8)
}

const previewUrl = (url) => {
  if (!url) return null
  const idx = url.indexOf('/upload/')
  if (idx === -1) return url
  return url.slice(0, idx + 8) + 'c_fit,w_400,h_260,q_auto,f_auto/' + url.slice(idx + 8)
}

const AssetRow = React.memo(function AssetRow({
  asset, staff, canEdit, onCycle, onDelete, onUploadReference, onUploadOutput, onUpdate,
  onDragStart, onDragOver, onDrop, requestConfirm, onGoToTasks,
}) {
  const isMobile = useIsMobile()
  const [h, setH] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadingOutput, setUploadingOutput] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)
  const outputFileRef = useRef(null)

  const handleDelete = useCallback(() => {
    requestConfirm(`Eliminare l'asset ${asset.name}?`, () => onDelete(asset.id))
  }, [asset.id, asset.name, onDelete, requestConfirm])

  const handleFileSelect = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file || !onUploadReference) return
    if (file.size > 5 * 1024 * 1024) return
    setUploading(true)
    try { await onUploadReference(asset.id, file) } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }, [asset.id, onUploadReference])

  const handleOutputSelect = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file || !onUploadOutput) return
    if (file.size > 30 * 1024 * 1024) return
    setUploadingOutput(true)
    try { await onUploadOutput(asset.id, file) } finally { setUploadingOutput(false); if (outputFileRef.current) outputFileRef.current.value = '' }
  }, [asset.id, onUploadOutput])

  const startEditing = useCallback(() => {
    setEditName(asset.name || '')
    setEditDesc(asset.description || '')
    setEditing(true)
  }, [asset.name, asset.description])

  const cancelEditing = useCallback(() => setEditing(false), [])

  const saveEditing = useCallback(async () => {
    if (!editName.trim()) return
    const updates = {}
    if (editName.trim() !== asset.name) updates.name = editName.trim()
    if (editDesc !== (asset.description || '')) updates.description = editDesc
    if (Object.keys(updates).length === 0) { setEditing(false); return }
    setSaving(true)
    try { await onUpdate(asset.id, updates); setEditing(false) } finally { setSaving(false) }
  }, [editName, editDesc, asset.id, asset.name, asset.description, onUpdate])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) saveEditing()
    if (e.key === 'Escape') cancelEditing()
  }, [saveEditing, cancelEditing])

  const handleDragStart = useCallback((e) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', asset.id)
    onDragStart?.(asset.id)
  }, [asset.id, onDragStart])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
    onDragOver?.(asset.id)
  }, [asset.id, onDragOver])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  const handleDropCb = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const draggedId = e.dataTransfer.getData('text/plain')
    if (draggedId && draggedId !== asset.id) {
      onDrop?.(draggedId, asset.id)
    }
  }, [asset.id, onDrop])

  if (editing) {
    const refImg = asset.ref_cloud_url
    const outImg = asset.output_cloud_url
    return (
      <div style={{
        padding: isMobile ? 10 : 16, borderRadius: 10,
        background: 'rgba(242,140,40,0.04)', border: `1px solid ${ACCENT}30`,
        margin: '4px 0',
      }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={handleKeyDown} placeholder="Asset name" autoFocus
            style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', border: '1px solid #E2E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: '#fff', width: 200 }} />
          <input value={editDesc} onChange={e => setEditDesc(e.target.value)} onKeyDown={handleKeyDown} placeholder="Description"
            style={{ fontSize: 12, color: '#475569', border: '1px solid #E2E8F0', borderRadius: 6, padding: '5px 8px', outline: 'none', background: '#fff', flex: 1, minWidth: 180, fontFamily: 'inherit' }} />
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
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

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={saveEditing} disabled={saving || !editName.trim()} style={{
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
          }}><IconTrash size={12} /> Elimina Asset</button>
        </div>
      </div>
    )
  }

  const refThumb = thumbUrl(asset.ref_cloud_url)

  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onDragOver={staff && canEdit ? handleDragOver : undefined}
      onDragLeave={staff && canEdit ? handleDragLeave : undefined}
      onDrop={staff && canEdit ? handleDropCb : undefined}
      style={{
        display: 'grid', gridTemplateColumns: GRID_COLS(isMobile), gap: isMobile ? 2 : 10,
        padding: isMobile ? '6px 0' : '10px 0', borderRadius: 8,
        background: dragOver ? 'rgba(242,140,40,0.08)' : h ? '#F8FAFC' : 'transparent',
        borderTop: dragOver ? `2px solid ${ACCENT}` : '2px solid transparent',
        transition: 'background 0.12s ease',
      }}
    >
      <div style={{ paddingLeft: isMobile ? 4 : 8, display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 8, minWidth: 0, overflow: 'hidden' }}>
        {staff && canEdit && !isMobile && (
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

        {refThumb && !isMobile && (
          <img src={refThumb} alt="" style={{ width: 28, height: 28, borderRadius: 5, objectFit: 'cover', flexShrink: 0, border: '1px solid #E2E8F0' }} />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 3 : 6 }}>
            <span style={{ fontSize: isMobile ? 11 : 14, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.name}</span>
          </div>
          {!isMobile && <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.description}</div>}
        </div>
        {h && !isMobile && staff && canEdit && (
          <button onClick={startEditing} style={{ ...iconBtnStyle, color: '#2563EB' }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '1' }} onMouseLeave={e => { e.currentTarget.style.opacity = '0.5' }}
            title="Modifica asset"><IconEdit size={14} /></button>
        )}
      </div>
      {ASSET_DEPTS.map(dept => (
        <ShotCell
          key={dept.id}
          status={asset[`status_${dept.id}`]}
          onClick={() => onCycle(asset, dept.id)}
          clickable={staff}
          disabled={false}
        />
      ))}
      {!isMobile && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {onGoToTasks && (
            <button onClick={() => onGoToTasks(asset.id)} style={{
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
  if (prev.canEdit !== next.canEdit) return false
  if (prev.asset.id !== next.asset.id) return false
  if (prev.asset.sort_order !== next.asset.sort_order) return false
  if (prev.asset.name !== next.asset.name) return false
  if (prev.asset.description !== next.asset.description) return false
  if (prev.asset.ref_cloud_url !== next.asset.ref_cloud_url) return false
  if (prev.asset.output_cloud_url !== next.asset.output_cloud_url) return false
  for (const d of ASSET_DEPTS) {
    if (prev.asset[`status_${d.id}`] !== next.asset[`status_${d.id}`]) return false
  }
  return true
})

export default AssetRow
