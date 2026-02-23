import { useState } from 'react'
import { DEPTS, isStaff } from '../../lib/constants'
import { updateProfileRole } from '../../lib/supabase'
import Fade from '../ui/Fade'
import Card from '../ui/Card'
import Av from '../ui/Av'
import Modal from '../ui/Modal'
import Select from '../ui/Select'
import Btn from '../ui/Btn'

export default function CrewPage({ profiles, user }) {
  const admin = user.role === 'admin'
  const [editUser, setEditUser] = useState(null)
  const [editRole, setEditRole] = useState('')
  const [editDept, setEditDept] = useState('')

  const grouped = {}
  DEPTS.forEach(d => grouped[d.id] = [])
  grouped['staff'] = []
  grouped['unassigned'] = []
  profiles.forEach(p => {
    if (isStaff(p.role)) grouped['staff'].push(p)
    else if (p.department && grouped[p.department]) grouped[p.department].push(p)
    else grouped['unassigned'].push(p)
  })

  const handleSaveRole = async () => {
    if (!editUser) return
    await updateProfileRole(editUser.id, editRole, editDept || null)
    setEditUser(null)
    window.location.reload()
  }

  const sections = [
    { key: 'staff', label: 'Staff', items: grouped.staff },
    ...DEPTS.map(d => ({ key: d.id, label: d.label, items: grouped[d.id] })),
    { key: 'unassigned', label: 'Non Assegnati', items: grouped.unassigned },
  ].filter(s => s.items.length > 0)

  return (
    <div>
      <Fade>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a2e' }}>Crew</h1>
        <p style={{ fontSize: 14, color: '#64748B', marginBottom: 32 }}>{profiles.length} membri</p>
      </Fade>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
        {sections.map((sec, si) => (
          <Fade key={sec.key} delay={si * 40}>
            <Card>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, display: 'flex', justifyContent: 'space-between', color: '#1a1a2e' }}>
                <span>{sec.label}</span>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{sec.items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sec.items.map(member => (
                  <MemberRow key={member.id} member={member} admin={admin}
                    onEdit={() => { setEditUser(member); setEditRole(member.role); setEditDept(member.department || '') }} />
                ))}
              </div>
            </Card>
          </Fade>
        ))}
      </div>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Modifica Ruolo — ${editUser?.full_name}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Select value={editRole} onChange={setEditRole}
            options={[
              { value: 'admin', label: 'Admin' },
              { value: 'docente', label: 'Docente' },
              { value: 'coordinatore', label: 'Coordinatore' },
              { value: 'studente', label: 'Studente' },
            ]} placeholder="Seleziona ruolo" />
          {editRole === 'studente' && (
            <Select value={editDept} onChange={setEditDept}
              options={DEPTS.map(d => ({ value: d.id, label: d.label }))} placeholder="Dipartimento" />
          )}
          <Btn variant="primary" onClick={handleSaveRole}>Salva</Btn>
        </div>
      </Modal>
    </div>
  )
}

function MemberRow({ member, admin, onEdit }) {
  const [h, setH] = useState(false)
  const staff = isStaff(member.role)
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16,
        background: h ? '#F8FAFC' : 'transparent', transition: 'all 0.12s ease',
      }}>
      <Av name={member.full_name} size={36} url={member.avatar_url} mood={member.mood_emoji} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>{member.full_name}</div>
        {/* #7: Staff don't show department */}
        <div style={{ fontSize: 11, color: '#94A3B8' }}>
          {member.role}
          {!staff && member.department && (() => {
            const d = DEPTS.find(dep => dep.id === member.department)
            return d ? ` · ${d.label}` : ''
          })()}
        </div>
      </div>
      {admin && h && (
        <button onClick={onEdit} style={{ background: 'none', border: 'none', color: '#6C5CE7', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>Modifica</button>
      )}
    </div>
  )
}
