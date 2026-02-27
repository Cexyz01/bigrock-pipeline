import { useState, useCallback, useRef } from 'react'
import { DEPTS, SHOT_STATUSES, isStaff, isAdmin, ACCENT } from '../../lib/constants'
import useIsMobile from '../../hooks/useIsMobile'
import Fade from '../ui/Fade'
import Btn from '../ui/Btn'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import EmptyState from '../ui/EmptyState'
import ShotRow from '../shots/ShotRow'
import { IconWrench, IconAlertTriangle, IconCamera, IconX } from '../ui/Icons'

export default function ShotTrackerPage({ shots, user, onUpdateShot, onCreateShot, onDeleteShot, onUploadReference, onSyncMiro, onFixMiro, addToast, requestConfirm }) {
  const [showCreate, setShowCreate] = useState(false)
  const [newShot, setNewShot] = useState({ code: '', sequence: 'SEQ01', description: '' })
  const [refFile, setRefFile] = useState(null)
  const [refPreview, setRefPreview] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [fixing, setFixing] = useState(false)
  const refInputRef = useRef(null)
  const staff = isStaff(user.role)
  const isMobile = useIsMobile()

  const handleSyncMiro = () => {
    requestConfirm(
      'Rebuild entire Miro?',
      'This operation deletes the entire Miro board and recreates it from scratch. Use "Fix Miro" to fix only missing images.',
      async () => {
        setSyncing(true)
        try { await onSyncMiro() } finally { setSyncing(false) }
      }
    )
  }

  const handleFixMiro = async () => {
    setFixing(true)
    try { await onFixMiro() } finally { setFixing(false) }
  }

  const cycleShotStatus = useCallback(async (shot, deptId) => {
    if (!staff) return
    const key = `status_${deptId}`
    const order = ['not_started', 'in_progress', 'review', 'approved']
    const curr = order.indexOf(shot[key])
    const next = order[(curr + 1) % order.length]
    await onUpdateShot(shot.id, { [key]: next })
  }, [staff, onUpdateShot])

  const handleMoveShot = useCallback(async (shotId, direction) => {
    if (!staff) return
    const shot = shots.find(s => s.id === shotId)
    if (!shot) return
    const seqShots = shots
      .filter(s => s.sequence === shot.sequence)
      .sort((a, b) => (a.sort_order - b.sort_order) || a.code.localeCompare(b.code))
    const idx = seqShots.findIndex(s => s.id === shotId)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= seqShots.length) return
    // Swap positions in array
    ;[seqShots[idx], seqShots[swapIdx]] = [seqShots[swapIdx], seqShots[idx]]
    // Reassign sort_order for all shots in this sequence
    await Promise.all(seqShots.map((s, i) => onUpdateShot(s.id, { sort_order: i })))
  }, [staff, shots, onUpdateShot])

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
    await onCreateShot(newShot, refFile)
    setNewShot({ code: '', sequence: 'SEQ01', description: '' })
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
            {staff && <Btn variant="primary" onClick={() => setShowCreate(true)} style={isMobile ? { fontSize: 12, padding: '6px 12px' } : {}}>+ Add Shot</Btn>}
            {isAdmin(user.role) && <Btn variant="default" loading={fixing} onClick={handleFixMiro} style={{ fontSize: 12, ...(isMobile ? { padding: '6px 10px' } : {}), display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconWrench size={14} /> Fix Miro</Btn>}
            {isAdmin(user.role) && <Btn variant="danger" loading={syncing} onClick={handleSyncMiro} style={{ fontSize: 12, ...(isMobile ? { padding: '6px 10px' } : {}), display: 'inline-flex', alignItems: 'center', gap: 5 }}><IconAlertTriangle size={14} /> Rebuild Miro</Btn>}
          </div>
        </div>
      </Fade>

      {/* Header */}
      <div>
      <div style={{
        display: 'grid', gridTemplateColumns: isMobile ? '2.2fr repeat(6, 1fr)' : '200px repeat(6, 80px)', gap: isMobile ? 2 : 3,
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
                {seqShots.map((shot, idx) => (
                  <ShotRow
                    key={shot.id}
                    shot={shot}
                    staff={staff}
                    onCycle={cycleShotStatus}
                    onDelete={onDeleteShot}
                    onMove={handleMoveShot}
                    onUploadReference={onUploadReference}
                    isFirst={idx === 0}
                    isLast={idx === seqShots.length - 1}
                    requestConfirm={requestConfirm}
                  />
                ))}
              </div>
            </Fade>
          )
        })
      )}

      </div>{/* close scroll wrapper */}

      {/* Legend */}
      <div style={{ display: 'flex', gap: isMobile ? 8 : 16, marginTop: 24, padding: '14px 0', borderTop: '1px solid #E8ECF1', flexWrap: 'wrap' }}>
        {SHOT_STATUSES.map(st => (
          <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: st.bg, border: `${st.id === 'review' ? '2.5px' : '1.5px'} solid ${st.id === 'review' ? '#2563EB' : `${st.color}50`}` }} />
            <span style={{ fontSize: 11, color: '#64748B' }}>{st.label}</span>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={handleCloseCreate} title="Add Shot">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input value={newShot.code} onChange={v => setNewShot(p => ({ ...p, code: v }))} placeholder="Shot code (e.g. SH010)" />
          <Input value={newShot.sequence} onChange={v => setNewShot(p => ({ ...p, sequence: v }))} placeholder="Sequence (e.g. SEQ01)" />
          <Input value={newShot.description} onChange={v => setNewShot(p => ({ ...p, description: v }))} placeholder="Description" />

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

          <Btn variant="primary" onClick={handleCreate} disabled={!newShot.code}>Create Shot</Btn>
        </div>
      </Modal>
    </div>
  )
}
