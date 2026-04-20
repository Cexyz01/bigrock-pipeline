import { useState, useCallback, useRef } from 'react'
import { SHOT_DEPTS as DEPTS, ASSET_DEPTS, SHOT_STATUSES, hasPermission, ACCENT } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import Fade from '../ui/Fade'
import Btn from '../ui/Btn'
import Pill from '../ui/Pill'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import EmptyState from '../ui/EmptyState'
import ShotRow from '../shots/ShotRow'
import AssetRow from '../assets/AssetRow'
import { IconCamera, IconX } from '../ui/Icons'

export default function ShotTrackerPage({
  shots, assets = [], user, canEditShots = true,
  onUpdateShot, onReorderShots, onCreateShot, onDeleteShot, onUploadReference, onUploadOutput,
  onCreateAsset, onUpdateAsset, onDeleteAsset, onReorderAssets, onUploadAssetReference, onUploadAssetOutput,
  addToast, requestConfirm, onGoToShotTasks, onGoToAssetTasks,
}) {
  const [activeTab, setActiveTab] = useState('shots')
  const [showCreate, setShowCreate] = useState(false)
  const [newShot, setNewShot] = useState({ code: '', sequence: 'SEQ01', description: '', disabled_depts: {} })
  const [refFile, setRefFile] = useState(null)
  const [refPreview, setRefPreview] = useState(null)
  const refInputRef = useRef(null)
  // Asset create modal state
  const [showCreateAsset, setShowCreateAsset] = useState(false)
  const [newAsset, setNewAsset] = useState({ name: '', description: '' })
  const [assetRefFile, setAssetRefFile] = useState(null)
  const [assetRefPreview, setAssetRefPreview] = useState(null)
  const assetRefInputRef = useRef(null)
  const staff = hasPermission(user, 'create_edit_shots')
  const isMobile = useIsMobile()

  // ── Asset handlers ────────────────────────────────────
  const cycleAssetStatus = useCallback(async (asset, deptId) => {
    if (!staff || !canEditShots) return
    const key = `status_${deptId}`
    const order = ['not_started', 'in_progress', 'review', 'approved']
    const curr = order.indexOf(asset[key])
    const next = order[(curr + 1) % order.length]
    await onUpdateAsset(asset.id, { [key]: next })
  }, [staff, canEditShots, onUpdateAsset])

  const handleAssetDrop = useCallback((draggedId, targetId) => {
    if (!staff || draggedId === targetId) return
    const dragged = assets.find(a => a.id === draggedId)
    const target = assets.find(a => a.id === targetId)
    if (!dragged || !target) return
    const ordered = [...assets].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))
    const without = ordered.filter(a => a.id !== draggedId)
    const targetIdx = without.findIndex(a => a.id === targetId)
    without.splice(targetIdx, 0, dragged)
    const changes = without
      .map((a, i) => (a.sort_order !== i ? { id: a.id, updates: { sort_order: i } } : null))
      .filter(Boolean)
    if (changes.length === 0) return
    if (onReorderAssets) {
      onReorderAssets(changes)
    } else {
      changes.forEach(c => onUpdateAsset(c.id, c.updates))
    }
  }, [staff, assets, onUpdateAsset, onReorderAssets])

  const handleAssetRefSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return
    setAssetRefFile(file)
    setAssetRefPreview(URL.createObjectURL(file))
  }

  const handleCreateAssetSubmit = async () => {
    if (!newAsset.name) return
    await onCreateAsset({ name: newAsset.name, description: newAsset.description }, assetRefFile)
    setNewAsset({ name: '', description: '' })
    setAssetRefFile(null)
    setAssetRefPreview(null)
    setShowCreateAsset(false)
  }

  const handleCloseCreateAsset = () => {
    setShowCreateAsset(false)
    setAssetRefFile(null)
    setAssetRefPreview(null)
    if (assetRefInputRef.current) assetRefInputRef.current.value = ''
  }

  const cycleShotStatus = useCallback(async (shot, deptId) => {
    if (!staff || !canEditShots) return
    const key = `status_${deptId}`
    const order = ['not_started', 'in_progress', 'review', 'approved']
    const curr = order.indexOf(shot[key])
    const next = order[(curr + 1) % order.length]
    await onUpdateShot(shot.id, { [key]: next })
  }, [staff, onUpdateShot])

  // Drag-drop reorder: move draggedId before targetId within same sequence.
  // Uses onReorderShots for a single batched optimistic update — instant feel.
  const handleDrop = useCallback((draggedId, targetId) => {
    if (!staff || draggedId === targetId) return
    const dragged = shots.find(s => s.id === draggedId)
    const target = shots.find(s => s.id === targetId)
    if (!dragged || !target || dragged.sequence !== target.sequence) return
    const seqShots = shots
      .filter(s => s.sequence === dragged.sequence)
      .sort((a, b) => (a.sort_order - b.sort_order) || a.code.localeCompare(b.code))
    const without = seqShots.filter(s => s.id !== draggedId)
    const targetIdx = without.findIndex(s => s.id === targetId)
    without.splice(targetIdx, 0, dragged)
    // Build only the changes (rows whose sort_order actually moved)
    const changes = without
      .map((s, i) => (s.sort_order !== i ? { id: s.id, updates: { sort_order: i } } : null))
      .filter(Boolean)
    if (changes.length === 0) return
    if (onReorderShots) {
      onReorderShots(changes)
    } else {
      // Fallback if batch handler not wired
      changes.forEach(c => onUpdateShot(c.id, c.updates))
    }
  }, [staff, shots, onUpdateShot, onReorderShots])

  const handleRefSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return
    setRefFile(file)
    const url = URL.createObjectURL(file)
    setRefPreview(url)
  }

  const handleCreate = async () => {
    if (!newShot.code) return
    const shotData = { code: newShot.code, sequence: newShot.sequence, description: newShot.description }
    // Only include disabled_depts if any are disabled
    if (newShot.disabled_depts && Object.keys(newShot.disabled_depts).length > 0) {
      shotData.disabled_depts = newShot.disabled_depts
    }
    await onCreateShot(shotData, refFile)
    setNewShot({ code: '', sequence: 'SEQ01', description: '', disabled_depts: {} })
    setRefFile(null)
    setRefPreview(null)
    setShowCreate(false)
  }

  const handleCloseCreate = () => {
    setShowCreate(false)
    setRefFile(null)
    setRefPreview(null)
    if (refInputRef.current) refInputRef.current.value = ''
  }

  const seqs = [...new Set(shots.map(sh => sh.sequence))].sort()
  const sortedAssets = [...assets].sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))

  return (
    <div style={{ maxWidth: '100%' }}>
      <Fade>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center',
          marginBottom: isMobile ? 16 : 28, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 0,
        }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' }}>Shot Tracker</h1>
            <p style={{ fontSize: isMobile ? 12 : 14, color: '#64748B' }}>{staff ? 'Click cells to change status' : 'Read-only view'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {staff && activeTab === 'assets' && <Btn variant="primary" onClick={() => setShowCreateAsset(true)} style={isMobile ? { fontSize: 12, padding: '6px 12px' } : {}}>+ Add Asset</Btn>}
            {staff && activeTab === 'shots' && <Btn variant="primary" onClick={() => setShowCreate(true)} style={isMobile ? { fontSize: 12, padding: '6px 12px' } : {}}>+ Add Shot</Btn>}
          </div>
        </div>
      </Fade>

      {/* Tab switcher */}
      <Fade delay={40}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, justifyContent: 'center' }}>
          <Pill label={`Shots${shots.length ? ` · ${shots.length}` : ''}`} active={activeTab === 'shots'} onClick={() => setActiveTab('shots')} />
          <Pill label={`Assets${assets.length ? ` · ${assets.length}` : ''}`} active={activeTab === 'assets'} onClick={() => setActiveTab('assets')} />
        </div>
      </Fade>

      {activeTab === 'assets' && (
        <div style={{ width: '100%' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? `2.2fr repeat(${ASSET_DEPTS.length}, 1fr)` : `minmax(220px, 1fr) repeat(${ASSET_DEPTS.length}, 80px) 64px`, gap: isMobile ? 2 : 3,
            padding: '10px 0 12px', borderBottom: '1px solid #E8ECF1', marginBottom: 6,
            position: 'sticky', top: 60, background: '#F0F2F5', zIndex: 5,
          }}>
            <div style={{ fontSize: isMobile ? 10 : 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: isMobile ? 4 : 8 }}>Asset</div>
            {ASSET_DEPTS.map(d => (
              <div key={d.id} style={{ fontSize: isMobile ? 8 : 11, textAlign: 'center', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: isMobile ? 8 : 10, marginTop: 2, fontWeight: 500 }}>{isMobile ? d.label.slice(0, 4) : d.label}</div>
              </div>
            ))}
          </div>
          {sortedAssets.length === 0 ? (
            <EmptyState title="No assets" sub={staff ? 'Add the first asset to get started' : 'Assets will appear here'} />
          ) : (
            <div>
              {sortedAssets.map((asset, idx) => (
                <Fade key={asset.id} delay={idx * 30}>
                  <AssetRow
                    asset={asset}
                    staff={staff}
                    canEdit={canEditShots}
                    onCycle={cycleAssetStatus}
                    onDelete={onDeleteAsset}
                    onUploadReference={onUploadAssetReference}
                    onUploadOutput={onUploadAssetOutput}
                    onUpdate={onUpdateAsset}
                    onDrop={handleAssetDrop}
                    requestConfirm={requestConfirm}
                    onGoToTasks={onGoToAssetTasks}
                  />
                </Fade>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'shots' && (
        <div style={{ width: '100%' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: isMobile ? `2.2fr repeat(${DEPTS.length}, 1fr)` : `minmax(220px, 1fr) repeat(${DEPTS.length}, 80px) 64px`, gap: isMobile ? 2 : 3,
            padding: '10px 0 12px', borderBottom: '1px solid #E8ECF1', marginBottom: 6,
            position: 'sticky', top: 60, background: '#F0F2F5', zIndex: 5,
          }}>
            <div style={{ fontSize: isMobile ? 10 : 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: isMobile ? 4 : 8 }}>Shot</div>
            {DEPTS.map(d => (
              <div key={d.id} style={{ fontSize: isMobile ? 8 : 11, textAlign: 'center', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: isMobile ? 8 : 10, marginTop: 2, fontWeight: 500 }}>{isMobile ? d.label.slice(0, 4) : d.label}</div>
              </div>
            ))}
          </div>

          {shots.length === 0 ? (
            <EmptyState title="No shots" sub={staff ? 'Add the first shot to get started' : 'Shots will appear here'} />
          ) : (
            seqs.map((seq, si) => {
              const seqShots = shots.filter(sh => sh.sequence === seq)
              return (
                <Fade key={seq} delay={si * 60}>
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#94A3B8', padding: '10px 8px 6px', letterSpacing: '0.04em' }}>{seq}</div>
                    {seqShots.map((shot) => (
                      <ShotRow
                        key={shot.id}
                        shot={shot}
                        staff={staff}
                        canEditShots={canEditShots}
                        onCycle={cycleShotStatus}
                        onDelete={onDeleteShot}
                        onUploadReference={onUploadReference}
                        onUploadOutput={onUploadOutput}
                        onUpdateShot={onUpdateShot}
                        onDrop={handleDrop}
                        requestConfirm={requestConfirm}
                        onGoToTasks={onGoToShotTasks}
                        sequences={seqs}
                      />
                    ))}
                  </div>
                </Fade>
              )
            })
          )}

          {/* Legend (only inside Shots tab) */}
          <div style={{ display: 'flex', gap: isMobile ? 8 : 16, marginTop: 24, padding: '14px 0', borderTop: '1px solid #E8ECF1', flexWrap: 'wrap', justifyContent: 'center' }}>
            {SHOT_STATUSES.map(st => (
              <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: st.bg, border: `${st.id === 'review' ? '2.5px' : '1.5px'} solid ${st.id === 'review' ? '#2563EB' : `${st.color}50`}` }} />
                <span style={{ fontSize: 11, color: '#64748B' }}>{st.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={handleCloseCreate} title="Add Shot">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input value={newShot.code} onChange={v => setNewShot(p => ({ ...p, code: v }))} placeholder="Shot code (e.g. SH010)" />
          <Input value={newShot.sequence} onChange={v => setNewShot(p => ({ ...p, sequence: v }))} placeholder="Sequence (e.g. SEQ01)" />
          <textarea value={newShot.description} onChange={e => setNewShot(p => ({ ...p, description: e.target.value }))} placeholder="Description" rows={4}
            style={{ fontSize: 13, color: '#1a1a1a', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', outline: 'none', background: '#F8FAFC', width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }} />

          {/* Reference image upload */}
          <div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>Reference Image (optional)</div>
            <input ref={refInputRef} type="file" accept="image/*" onChange={handleRefSelect} style={{ display: 'none' }} />
            {refPreview ? (
              <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '2px solid ' + ACCENT }}>
                <img src={refPreview} alt="Reference" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
                <button
                  onClick={() => { setRefFile(null); setRefPreview(null); if (refInputRef.current) refInputRef.current.value = '' }}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                ><IconX size={14} /></button>
              </div>
            ) : (
              <div
                onClick={() => refInputRef.current?.click()}
                style={{ border: '2px dashed #CBD5E1', borderRadius: 8, padding: '20px 0', textAlign: 'center', cursor: 'pointer', color: '#94A3B8', fontSize: 13, transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#CBD5E1'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconCamera size={16} /> Click to select image</span>
              </div>
            )}
          </div>

          {/* Department toggles */}
          <div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>Departments (deselect to disable)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DEPTS.map(d => {
                const enabled = !newShot.disabled_depts?.[d.id]
                return (
                  <button key={d.id} type="button" onClick={() => setNewShot(p => {
                    const dd = { ...(p.disabled_depts || {}) }
                    if (dd[d.id]) { delete dd[d.id] } else { dd[d.id] = true }
                    return { ...p, disabled_depts: dd }
                  })} style={{
                    padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${enabled ? d.color : '#CBD5E1'}`,
                    background: enabled ? `${d.color}18` : '#F1F5F9',
                    color: enabled ? d.color : '#94A3B8',
                    transition: 'all 0.15s ease',
                  }}>{d.label}</button>
                )
              })}
            </div>
          </div>

          <Btn variant="primary" onClick={handleCreate} disabled={!newShot.code}>Create Shot</Btn>
        </div>
      </Modal>

      {/* Create Asset Modal */}
      <Modal open={showCreateAsset} onClose={handleCloseCreateAsset} title="Add Asset">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input value={newAsset.name} onChange={v => setNewAsset(p => ({ ...p, name: v }))} placeholder="Asset name (e.g. Protagonist)" />
          <textarea value={newAsset.description} onChange={e => setNewAsset(p => ({ ...p, description: e.target.value }))} placeholder="Description" rows={4}
            style={{ fontSize: 13, color: '#1a1a1a', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', outline: 'none', background: '#F8FAFC', width: '100%', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5, boxSizing: 'border-box' }} />

          <div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 500 }}>Reference Image (optional)</div>
            <input ref={assetRefInputRef} type="file" accept="image/*" onChange={handleAssetRefSelect} style={{ display: 'none' }} />
            {assetRefPreview ? (
              <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '2px solid ' + ACCENT }}>
                <img src={assetRefPreview} alt="Reference" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
                <button
                  onClick={() => { setAssetRefFile(null); setAssetRefPreview(null); if (assetRefInputRef.current) assetRefInputRef.current.value = '' }}
                  style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                ><IconX size={14} /></button>
              </div>
            ) : (
              <div
                onClick={() => assetRefInputRef.current?.click()}
                style={{ border: '2px dashed #CBD5E1', borderRadius: 8, padding: '20px 0', textAlign: 'center', cursor: 'pointer', color: '#94A3B8', fontSize: 13, transition: 'border-color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#CBD5E1'}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconCamera size={16} /> Click to select image</span>
              </div>
            )}
          </div>

          <Btn variant="primary" onClick={handleCreateAssetSubmit} disabled={!newAsset.name}>Create Asset</Btn>
        </div>
      </Modal>
    </div>
  )
}
