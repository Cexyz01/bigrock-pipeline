import { useState, useEffect } from 'react'
import { DEPTS, isStaff, isAdmin, displayRole } from '../../lib/constants'
import { getProjectMembers } from '../../lib/supabase'
import useIsMobile from '../../hooks/useIsMobile'
import Fade from '../ui/Fade'
import Card from '../ui/Card'
import Av from '../ui/Av'

export default function CrewPage({ profiles, user, currentProject }) {
  const isMobile = useIsMobile()
  const [memberData, setMemberData] = useState([])

  // Load project members with project_role
  useEffect(() => {
    if (!currentProject) return
    getProjectMembers(currentProject.id).then(setMemberData)
  }, [currentProject?.id])

  // Build a map of user_id -> project_role
  const memberRoleMap = {}
  const memberIds = new Set()
  memberData.forEach(m => {
    if (!m.user) return // skip members with missing profile
    memberIds.add(m.user_id)
    if (m.project_role) memberRoleMap[m.user_id] = m.project_role
  })

  // Filter profiles to only project members
  const visibleProfiles = memberData.length > 0
    ? profiles.filter(p => memberIds.has(p.id))
    : profiles

  // Group by project_role for students, staff separate
  const grouped = {}
  DEPTS.forEach(d => grouped[d.id] = [])
  grouped['staff'] = []
  grouped['unassigned'] = []
  visibleProfiles.forEach(p => {
    if (isStaff(p)) {
      grouped['staff'].push(p)
    } else {
      const projRole = memberRoleMap[p.id]
      if (projRole && grouped[projRole]) grouped[projRole].push(p)
      else grouped['unassigned'].push(p)
    }
  })

  const sections = [
    { key: 'staff', label: 'Staff', items: grouped.staff },
    ...DEPTS.map(d => ({ key: d.id, label: d.label, items: grouped[d.id] })),
    { key: 'unassigned', label: 'Non assegnati', items: grouped.unassigned },
  ].filter(s => s.items.length > 0)

  return (
    <div>
      <Fade>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px', color: '#1a1a1a' }}>Crew</h1>
        <p style={{ fontSize: 14, color: '#64748B', marginBottom: 32 }}>{visibleProfiles.length} membri</p>
      </Fade>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? 12 : 20 }}>
        {sections.map((sec, si) => (
          <Fade key={sec.key} delay={si * 40}>
            <Card>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, display: 'flex', justifyContent: 'space-between', color: '#1a1a1a' }}>
                <span>{sec.label}</span>
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{sec.items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {sec.items.map(member => (
                  <MemberRow key={member.id} member={member} projectRole={memberRoleMap[member.id]} />
                ))}
              </div>
            </Card>
          </Fade>
        ))}
      </div>
    </div>
  )
}

function MemberRow({ member, projectRole }) {
  const [h, setH] = useState(false)
  const staff = isStaff(member)
  const dept = projectRole ? DEPTS.find(d => d.id === projectRole) : null
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 16,
        background: h ? '#F8FAFC' : 'transparent', transition: 'all 0.12s ease',
      }}>
      <Av name={member.full_name} size={36} url={member.avatar_url} mood={member.mood_emoji} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{member.full_name}</div>
        <div style={{ fontSize: 11, color: '#94A3B8' }}>
          {member.role === 'super_admin' ? 'Admin' : displayRole(member.role)}
          {!staff && dept && ` · ${dept.label}`}
        </div>
      </div>
    </div>
  )
}
