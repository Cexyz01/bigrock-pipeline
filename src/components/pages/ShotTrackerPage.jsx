import { useState, useCallback } from 'react'
import { DEPTS, SHOT_STATUSES, isStaff } from '../../lib/constants'
import Fade from '../ui/Fade'
import Btn from '../ui/Btn'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import EmptyState from '../ui/EmptyState'
import ShotRow from '../shots/ShotRow'

export default function ShotTrackerPage({ shots, user, onUpdateShot, onCreateShot, onDeleteShot, onUploadReference, requestConfirm }) {
  const [showCreate, setShowCreate] = useState(false)
  const [newShot, setNewShot] = useState({ code: '', sequence: 'SEQ01', description: '' })
  const staff = isStaff(user.role)

  const cycleShotStatus = useCallback(async (shot, deptId) => {
    if (!staff) return
    const key = `status_${deptId}`
    const order = ['not_started', 'in_progress', 'review', 'needs_revision', 'approved']
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

  const handleCreate = async () => {
    if (!newShot.code) return
    await onCreateShot(newShot)
    setNewShot({ code: '', sequence: 'SEQ01', description: '' })
    setShowCreate(false)
  }

  const seqs = [...new Set(shots.map(sh => sh.sequence))].sort()

  return (
    <div>
      <Fade>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 4px', color: '#1a1a2e' }}>Shot Tracker</h1>
            <p style={{ fontSize: 14, color: '#64748B' }}>{staff ? 'Clicca le celle per cambiare stato' : 'Vista in sola lettura'}</p>
          </div>
          {staff && <Btn variant="primary" onClick={() => setShowCreate(true)}>+ Aggiungi Shot</Btn>}
        </div>
      </Fade>

      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '200px repeat(6, 80px)', gap: 3,
        padding: '10px 0 12px', borderBottom: '1px solid #E8ECF1', marginBottom: 6,
        position: 'sticky', top: 60, background: '#F0F2F5', zIndex: 5,
      }}>
        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', paddingLeft: 8 }}>Shot</div>
        {DEPTS.map(d => (
          <div key={d.id} style={{ fontSize: 11, textAlign: 'center', color: '#64748B' }}>
            <div style={{ fontSize: 10, marginTop: 2, fontWeight: 500 }}>{d.label}</div>
          </div>
        ))}
      </div>

      {shots.length === 0 ? (
        <EmptyState title="Nessuno shot" sub={staff ? 'Aggiungi il primo shot per iniziare' : 'Gli shot appariranno qui'} />
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

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 24, padding: '14px 0', borderTop: '1px solid #E8ECF1' }}>
        {SHOT_STATUSES.map(st => (
          <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: st.bg, border: `1.5px solid ${st.color}50` }} />
            <span style={{ fontSize: 11, color: '#64748B' }}>{st.label}</span>
          </div>
        ))}
      </div>

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Aggiungi Shot">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Input value={newShot.code} onChange={v => setNewShot(p => ({ ...p, code: v }))} placeholder="Codice shot (es. SH010)" />
          <Input value={newShot.sequence} onChange={v => setNewShot(p => ({ ...p, sequence: v }))} placeholder="Sequenza (es. SEQ01)" />
          <Input value={newShot.description} onChange={v => setNewShot(p => ({ ...p, description: v }))} placeholder="Descrizione" />
          <Btn variant="primary" onClick={handleCreate}>Crea Shot</Btn>
        </div>
      </Modal>
    </div>
  )
}
