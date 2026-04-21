import { useState, useEffect } from 'react'
import { isAdmin, isStaff, hasPermission, ACCENT, DEPTS, PERMISSION_CATALOG, ALL_PERMISSION_IDS, displayRole, SUPER_ADMIN_EMAILS } from '../../lib/constants'
import { createProject, updateProject, deleteProject, getProjectMembers, addProjectMember, removeProjectMember, updateProjectMember, updateProfileRole, updateProfileFlag, subscribeToTable, sendSuperNotification, getRoles, createRole, updateRole, deleteRole, assignRole } from '../../lib/supabase'
import { getCloudinaryUsage } from '../../lib/miro'
import Btn from '../ui/Btn'
import Modal from '../ui/Modal'
import Input from '../ui/Input'
import Av from '../ui/Av'
import Card from '../ui/Card'
import { IconPlus, IconTrash, IconEdit } from '../ui/Icons'

export default function ProjectManagementPage({ user, profiles, projects, myPerms, onRefreshProjects, onRefreshProfiles, addToast, requestConfirm }) {
  const canManageRoles = hasPermission(user, 'manage_roles')
  const canManageProjects = hasPermission(user, 'manage_project_settings') || canManageRoles || myPerms?.can_manage_project || hasPermission(user, 'create_projects')
  const canSendNotifs = hasPermission(user, 'send_notifications')
  const tabs = []
  tabs.push({ id: 'members', label: 'Membri' })
  if (canManageProjects) tabs.push({ id: 'projects', label: 'Progetti' })
  if (canManageRoles) tabs.push({ id: 'roles', label: 'Ruoli' })
  if (canSendNotifs) tabs.push({ id: 'admin', label: 'Admin' })
  const [tab, setTab] = useState('members')

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', margin: '0 0 20px' }}>Gestione</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #E8ECF1' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
            background: 'none', color: tab === t.id ? ACCENT : '#94A3B8',
            borderBottom: tab === t.id ? `2px solid ${ACCENT}` : '2px solid transparent',
            marginBottom: -2, transition: 'all 0.15s ease',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'members' && <MembersTab user={user} profiles={profiles} projects={projects} addToast={addToast} myPerms={myPerms} />}
      {tab === 'projects' && canManageProjects && <ProjectsTab user={user} projects={projects} onRefreshProjects={onRefreshProjects} addToast={addToast} requestConfirm={requestConfirm} />}
      {tab === 'roles' && canManageRoles && <RolesManager user={user} profiles={profiles} addToast={addToast} onRefreshProfiles={onRefreshProfiles} />}
      {tab === 'admin' && canSendNotifs && <AdminTab user={user} profiles={profiles} addToast={addToast} />}
    </div>
  )
}

// ═══════════════════════════════════════════════
// TAB: MEMBRI — checklist per progetto
// ═══════════════════════════════════════════════

function MembersTab({ user, profiles, projects, addToast, myPerms }) {
  const admin = hasPermission(user, 'manage_roles')
  const [selectedProject, setSelectedProject] = useState(projects[0] || null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedProject?.id) return
    setLoading(true)
    const load = () => getProjectMembers(selectedProject.id).then(m => { setMembers(m || []); setLoading(false) })
    load()
    // Realtime: no filter so DELETE events are also captured
    const channel = subscribeToTable('project_members', load)
    return () => { if (channel) channel.unsubscribe() }
  }, [selectedProject?.id])

  const memberMap = {}
  members.forEach(m => { if (m.user_id) memberMap[m.user_id] = m })

  const handleToggleMember = async (profile, checked) => {
    if (!selectedProject) return
    if (checked) {
      // Optimistic: add fake member to state immediately
      const fakeMember = {
        id: 'temp-' + profile.id, project_id: selectedProject.id, user_id: profile.id,
        user: profile, project_role: null,
      }
      setMembers(prev => [...prev, fakeMember])
      // DB call in background
      const { error } = await addProjectMember(selectedProject.id, profile.id, user.id)
      if (error) { addToast('Errore: ' + error.message, 'danger'); setMembers(prev => prev.filter(m => m.user_id !== profile.id)); return }
    } else {
      // Optimistic: remove from state immediately
      setMembers(prev => prev.filter(m => m.user_id !== profile.id))
      const { error } = await removeProjectMember(selectedProject.id, profile.id)
      if (error) { addToast('Errore: ' + error.message, 'danger'); return }
    }
  }

  const handleUpdateField = async (userId, field, value) => {
    if (!selectedProject) return
    // Optimistic update
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, [field]: value } : m))
    // DB in background
    const { error } = await updateProjectMember(selectedProject.id, userId, { [field]: value })
    if (error) addToast('Errore: ' + error.message, 'danger')
  }

  // Separate staff and students
  const staffProfiles = profiles.filter(p => isStaff(p))
  const studentProfiles = profiles.filter(p => !isStaff(p))
  // Who can manage staff toggles
  const canManageAll = admin || myPerms?.can_manage_project

  return (
    <div>
      {/* Project selector */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#64748B' }}>Progetto:</span>
        <select
          value={selectedProject?.id || ''}
          onChange={e => {
            const p = projects.find(p => p.id === e.target.value)
            setSelectedProject(p || null)
          }}
          style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #E8ECF1', fontSize: 13, minWidth: 200, outline: 'none' }}
        >
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94A3B8' }}>Caricamento...</div>
      ) : (
        <>
          {/* Staff section */}
          {canManageAll && staffProfiles.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={sectionTitle}>Staff ({staffProfiles.length})</div>
              <Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {staffProfiles.map(p => {
                    const m = memberMap[p.id]
                    const isMember = !!m
                    return (
                      <div key={p.id} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        borderBottom: '1px solid #F8FAFC',
                        opacity: isMember ? 1 : 0.5,
                      }}>
                        <input
                          type="checkbox" checked={isMember}
                          onChange={e => handleToggleMember(p, e.target.checked)}
                          style={{ accentColor: ACCENT, width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <Av name={p.full_name} size={30} url={p.avatar_url} mood={p.mood_emoji} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{p.full_name}</div>
                          <div style={{ fontSize: 11, color: '#94A3B8' }}>{displayRole(p)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          )}

          {/* Students section */}
          <div>
            <div style={sectionTitle}>Studenti ({studentProfiles.length})</div>
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {studentProfiles.map(p => {
                  const m = memberMap[p.id]
                  const isMember = !!m
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      borderBottom: '1px solid #F8FAFC',
                      opacity: isMember ? 1 : 0.5,
                    }}>
                      <input
                        type="checkbox" checked={isMember}
                        onChange={e => handleToggleMember(p, e.target.checked)}
                        style={{ accentColor: ACCENT, width: 16, height: 16, cursor: 'pointer' }}
                      />
                      <Av name={p.full_name} size={30} url={p.avatar_url} mood={p.mood_emoji} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{p.full_name}</div>
                        <div style={{ fontSize: 11, color: '#94A3B8' }}>{displayRole(p)}</div>
                      </div>
                      {/* Department selector — only when member */}
                      {isMember && (
                        <select
                          value={m.project_role || ''}
                          onChange={e => handleUpdateField(p.id, 'project_role', e.target.value || null)}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #E8ECF1', fontSize: 12, outline: 'none', minWidth: 120 }}
                        >
                          <option value="">— Reparto —</option>
                          {DEPTS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                        </select>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════
// TAB: PROGETTI — crea/modifica/elimina
// ═══════════════════════════════════════════════

function ProjectsTab({ user, projects, onRefreshProjects, addToast, requestConfirm }) {
  const admin = hasPermission(user, 'manage_project_settings')
  const [createOpen, setCreateOpen] = useState(false)
  const [editProject, setEditProject] = useState(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [creating, setCreating] = useState(false)

  const openCreate = () => { setName(''); setDescription(''); setStartDate(''); setEndDate(''); setCreateOpen(true) }
  const openEdit = (p) => { setName(p.name); setDescription(p.description || ''); setStartDate(p.start_date || ''); setEndDate(p.end_date || ''); setEditProject(p) }

  const handleCreate = async () => {
    if (!name.trim()) return
    setCreating(true)
    const proj = { name: name.trim(), description: description.trim(), created_by: user.id }
    if (startDate) proj.start_date = startDate
    if (endDate) proj.end_date = endDate
    const { data, error } = await createProject(proj)
    if (error) { addToast('Errore creazione progetto: ' + error.message, 'danger'); setCreating(false); return }

    if (data) {
      await addProjectMember(data.id, user.id, user.id)
      addToast('Progetto creato!', 'success')
    }
    setCreating(false)
    setCreateOpen(false)
    onRefreshProjects()
  }

  const handleEdit = async () => {
    if (!editProject || !name.trim()) return
    const { error } = await updateProject(editProject.id, {
      name: name.trim(), description: description.trim(),
      start_date: startDate || null, end_date: endDate || null,
    })
    if (error) { addToast('Errore: ' + error.message, 'danger'); return }
    setEditProject(null)
    onRefreshProjects()
    addToast('Progetto aggiornato', 'success')
  }

  const handleDelete = (proj) => {
    requestConfirm(`Eliminare "${proj.name}" e tutti i dati associati?`, async () => {
      await deleteProject(proj.id)
      onRefreshProjects()
      addToast('Progetto eliminato', 'success')
    })
  }

  const formFields = (
    <>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Nome progetto *</label>
        <Input value={name} onChange={setName} placeholder="Es: Cortometraggio 2026" />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Descrizione</label>
        <Input value={description} onChange={setDescription} placeholder="Opzionale" />
      </div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Data inizio</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={dateInputStyle} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Data fine</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={dateInputStyle} />
        </div>
      </div>
    </>
  )

  return (
    <div>
      {(admin || user.can_create_projects) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Btn onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconPlus size={16} /> Nuovo Progetto
          </Btn>
        </div>
      )}

      {projects.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#94A3B8', fontSize: 14 }}>Nessun progetto.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {projects.map(p => (
            <div key={p.id} style={{
              background: '#fff', borderRadius: 14, border: '1px solid #E8ECF1',
              padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, background: ACCENT + '15',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color: ACCENT, flexShrink: 0,
              }}>{p.name.slice(0, 2).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{p.name}</div>
                {p.description && <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{p.description}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 4, fontSize: 11, color: '#94A3B8' }}>
                  {p.start_date && <span>Inizio: {p.start_date}</span>}
                  {p.end_date && <span>Fine: {p.end_date}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => openEdit(p)} style={iconBtn}><IconEdit size={16} color="#64748B" /></button>
                {(admin || (user.can_create_projects && p.created_by === user.id)) && (
                  <button onClick={() => handleDelete(p)} style={{ ...iconBtn, border: '1px solid #FECACA', background: '#FFF5F5' }}>
                    <IconTrash size={16} color="#EF4444" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nuovo Progetto">
        {formFields}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Btn onClick={() => setCreateOpen(false)}>Annulla</Btn>
          <Btn variant="primary" onClick={handleCreate} disabled={creating || !name.trim()}>
            {creating ? 'Creando...' : 'Crea Progetto'}
          </Btn>
        </div>
      </Modal>

      <Modal open={!!editProject} onClose={() => setEditProject(null)} title="Modifica Progetto">
        {formFields}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <Btn onClick={() => setEditProject(null)}>Annulla</Btn>
          <Btn variant="primary" onClick={handleEdit} disabled={!name.trim()}>Salva</Btn>
        </div>
      </Modal>
    </div>
  )
}

// ═══════════════════════════════════════════════
// TAB: RUOLI — ruoli globali (admin only)
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// TAB: RUOLI — CRUD ruoli + griglia permessi + assegnazione utenti
// ═══════════════════════════════════════════════

function RolesManager({ user, profiles, addToast, onRefreshProfiles }) {
  const [roles, setRoles] = useState([])
  const [editingRole, setEditingRole] = useState(null) // null = list, object = editing
  const [saving, setSaving] = useState(false)
  const [assigning, setAssigning] = useState({})
  const [search, setSearch] = useState('')

  const loadRoles = async () => { const { data } = await getRoles(); setRoles(data) }
  useEffect(() => { loadRoles() }, [])

  // Count users per role
  const userCountByRole = {}
  profiles.forEach(p => { const rid = p.role_id; if (rid) userCountByRole[rid] = (userCountByRole[rid] || 0) + 1 })

  // ── Role Editor ──
  const handleNewRole = () => {
    const perms = {}; ALL_PERMISSION_IDS.forEach(id => { perms[id] = false })
    setEditingRole({ name: '', slug: '', description: '', permissions: perms, is_preset: false, isNew: true })
  }

  const handleEditRole = (role) => {
    const perms = { ...role.permissions }
    ALL_PERMISSION_IDS.forEach(id => { if (perms[id] === undefined) perms[id] = false })
    setEditingRole({ ...role, permissions: perms })
  }

  const handleSaveRole = async () => {
    if (!editingRole.name.trim()) { addToast('Inserisci un nome per il ruolo', 'danger'); return }
    setSaving(true)
    const slug = editingRole.isNew ? editingRole.name.trim().toLowerCase().replace(/[^a-z0-9]/g, '_') : editingRole.slug
    if (editingRole.isNew) {
      const { error } = await createRole(editingRole.name.trim(), slug, editingRole.description, editingRole.permissions)
      if (error) { addToast('Errore: ' + error.message, 'danger'); setSaving(false); return }
      addToast('Ruolo creato', 'success')
    } else {
      const { error } = await updateRole(editingRole.id, { name: editingRole.name, description: editingRole.description, permissions: editingRole.permissions })
      if (error) { addToast('Errore: ' + error.message, 'danger'); setSaving(false); return }
      addToast('Ruolo aggiornato', 'success')
    }
    setSaving(false); setEditingRole(null); await loadRoles(); if (onRefreshProfiles) await onRefreshProfiles()
  }

  const handleDeleteRole = async (role) => {
    if (role.is_preset) { addToast('I ruoli preset non possono essere eliminati', 'danger'); return }
    const { error } = await deleteRole(role.id)
    if (error) { addToast('Errore: ' + error.message, 'danger'); return }
    addToast('Ruolo eliminato', 'success'); await loadRoles(); if (onRefreshProfiles) await onRefreshProfiles()
  }

  const handleAssignRole = async (profile, roleId) => {
    const role = roles.find(r => r.id === roleId)
    if (!role) return
    setAssigning(s => ({ ...s, [profile.id]: true }))
    const { error } = await assignRole(profile.id, roleId, role.slug)
    setAssigning(s => ({ ...s, [profile.id]: false }))
    if (error) { addToast('Errore: ' + error.message, 'danger'); return }
    addToast(`Ruolo di ${profile.full_name} aggiornato a ${role.name}`, 'success')
    if (onRefreshProfiles) await onRefreshProfiles()
  }

  const togglePerm = (permId) => {
    setEditingRole(r => ({ ...r, permissions: { ...r.permissions, [permId]: !r.permissions[permId] } }))
  }

  const toggleCategory = (cat, val) => {
    const update = {}; cat.permissions.forEach(p => { update[p.id] = val })
    setEditingRole(r => ({ ...r, permissions: { ...r.permissions, ...update } }))
  }

  // ── Render Role Editor ──
  if (editingRole) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => setEditingRole(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#64748B' }}>←</button>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
            {editingRole.isNew ? 'Nuovo Ruolo' : `Modifica: ${editingRole.name}`}
          </h2>
          {editingRole.is_preset && <span style={{ fontSize: 10, fontWeight: 600, color: ACCENT, background: ACCENT + '15', padding: '2px 8px', borderRadius: 4 }}>PRESET</span>}
        </div>

        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={labelStyle}>Nome ruolo</label>
              <input value={editingRole.name} onChange={e => setEditingRole(r => ({ ...r, name: e.target.value }))}
                disabled={editingRole.is_preset} placeholder="es. Supervisor"
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E8ECF1', fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ flex: 2, minWidth: 300 }}>
              <label style={labelStyle}>Descrizione</label>
              <input value={editingRole.description} onChange={e => setEditingRole(r => ({ ...r, description: e.target.value }))}
                placeholder="Descrizione opzionale..."
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E8ECF1', fontSize: 13, outline: 'none' }} />
            </div>
          </div>
        </Card>

        <Card style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 16 }}>Permessi</div>
          {PERMISSION_CATALOG.map(cat => {
            const allOn = cat.permissions.every(p => editingRole.permissions[p.id])
            const someOn = cat.permissions.some(p => editingRole.permissions[p.id])
            return (
              <div key={cat.category} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <input type="checkbox" checked={allOn} ref={el => { if (el) el.indeterminate = someOn && !allOn }}
                    onChange={() => toggleCategory(cat, !allOn)}
                    style={{ accentColor: ACCENT, width: 14, height: 14 }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{cat.category}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '4px 16px', paddingLeft: 22 }}>
                  {cat.permissions.map(perm => (
                    <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 0' }}>
                      <input type="checkbox" checked={!!editingRole.permissions[perm.id]}
                        onChange={() => togglePerm(perm.id)}
                        style={{ accentColor: ACCENT, width: 14, height: 14 }} />
                      <span style={{ fontSize: 12, color: '#334155' }}>{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </Card>

        <div style={{ display: 'flex', gap: 10 }}>
          <Btn variant="primary" onClick={handleSaveRole} disabled={saving}>
            {saving ? 'Salvataggio...' : 'Salva ruolo'}
          </Btn>
          <Btn onClick={() => setEditingRole(null)}>Annulla</Btn>
        </div>
      </div>
    )
  }

  // ── Render Role List + User Assignment ──
  const filteredProfiles = profiles.filter(p =>
    !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.email?.toLowerCase().includes(search.toLowerCase())
  )
  const sorted = [...filteredProfiles].sort((a, b) => {
    const aS = isStaff(a) ? 0 : 1; const bS = isStaff(b) ? 0 : 1
    if (aS !== bS) return aS - bS
    return (a.full_name || '').localeCompare(b.full_name || '')
  })

  return (
    <div>
      {/* Role List */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Ruoli</div>
          <Btn variant="primary" size="sm" onClick={handleNewRole}><IconPlus size={12} /> Nuovo Ruolo</Btn>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {roles.map(r => (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              borderRadius: 8, background: '#FAFBFC', border: '1px solid #F1F5F9', cursor: 'pointer',
              transition: 'all 0.15s', marginBottom: 4,
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F1F5F9' }}
              onMouseLeave={e => { e.currentTarget.style.background = '#FAFBFC' }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{r.name}</span>
                  {r.is_preset && <span style={{ fontSize: 9, fontWeight: 600, color: ACCENT, background: ACCENT + '15', padding: '1px 6px', borderRadius: 3 }}>PRESET</span>}
                  <span style={{ fontSize: 11, color: '#94A3B8' }}>{userCountByRole[r.id] || 0} utenti</span>
                </div>
                {r.description && <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{r.description}</div>}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => handleEditRole(r)} style={{ ...iconBtn, borderColor: '#E0E0E0' }} title="Modifica">
                  <IconEdit size={14} />
                </button>
                {!r.is_preset && (
                  <button onClick={() => handleDeleteRole(r)} style={{ ...iconBtn, borderColor: '#FCA5A5', color: '#EF4444' }} title="Elimina">
                    <IconTrash size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* User Assignment */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Assegnazione Ruoli</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca utente..."
            style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #E8ECF1', fontSize: 12, outline: 'none', width: 200 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 180px',
            gap: 12, padding: '8px 14px', fontSize: 11, fontWeight: 600,
            color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em',
            borderBottom: '1px solid #F1F5F9',
          }}>
            <span>Utente</span>
            <span>Ruolo</span>
          </div>
          {sorted.map(p => {
            const isProtected = SUPER_ADMIN_EMAILS.includes(p.email)
            const disabled = isProtected || assigning[p.id]
            return (
              <div key={p.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 180px',
                gap: 12, padding: '10px 14px', alignItems: 'center',
                borderBottom: '1px solid #F8FAFC', opacity: disabled ? 0.6 : 1,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <Av name={p.full_name} size={30} url={p.avatar_url} mood={p.mood_emoji} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.full_name}
                      {isProtected && <span style={{ fontSize: 10, color: ACCENT, marginLeft: 6 }}>Super Admin</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.email}</div>
                  </div>
                </div>
                {isProtected ? (
                  <span style={{ fontSize: 12, fontWeight: 600, color: ACCENT }}>Super Admin</span>
                ) : (
                  <select value={p.role_id || ''} onChange={e => handleAssignRole(p, e.target.value)}
                    disabled={disabled}
                    style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #E8ECF1', fontSize: 12, outline: 'none' }}>
                    <option value="">— Nessun ruolo —</option>
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

// ═══════════════════════════════════════════════
// TAB: ADMIN — Super Notifiche
// ═══════════════════════════════════════════════

function AdminTab({ user, profiles, addToast }) {
  const [snTarget, setSnTarget] = useState('')
  const [snMessage, setSnMessage] = useState('')
  const [snSending, setSnSending] = useState(false)

  const handleSendSuperNotif = async () => {
    if (!snTarget || !snMessage.trim()) return
    setSnSending(true)
    const { error } = await sendSuperNotification(snTarget, user.id, snMessage.trim())
    setSnSending(false)
    if (error) { addToast('Errore invio: ' + error.message, 'danger'); return }
    const target = profiles.find(p => p.id === snTarget)
    addToast(`Super notifica inviata a ${target?.full_name || 'utente'}`, 'success')
    setSnMessage(''); setSnTarget('')
  }

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <CloudinaryUsageCard addToast={addToast} />
      </div>
      <Card>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', marginBottom: 12 }}>Super Notifica</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: '0 0 200px' }}>
            <label style={labelStyle}>Destinatario</label>
            <select value={snTarget} onChange={e => setSnTarget(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #E8ECF1', fontSize: 12, outline: 'none' }}>
              <option value="">— Seleziona —</option>
              {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={labelStyle}>Messaggio</label>
            <Input value={snMessage} onChange={setSnMessage} placeholder="Scrivi il messaggio..." />
          </div>
          <Btn variant="primary" onClick={handleSendSuperNotif} disabled={snSending || !snTarget || !snMessage.trim()}>
            {snSending ? 'Invio...' : 'Invia'}
          </Btn>
        </div>
        <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
          Verrà mostrata come overlay quando l'utente apre il sito. Lettura obbligatoria (5s timer).
        </div>
      </Card>
    </>
  )
}

// ═══════════════════════════════════════════════
// CLOUDINARY USAGE CARD
// ═══════════════════════════════════════════════

function CloudinaryUsageCard({ addToast }) {
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true); setError(null)
    const { data, error } = await getCloudinaryUsage()
    setLoading(false)
    if (error) { setError(error); return }
    setUsage(data)
  }

  useEffect(() => { load() }, [])

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Cloudinary</div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
            Stato di utilizzo del piano — serve per capire quando fare upgrade
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {usage?.plan && (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1a1a1a', background: '#F1F5F9', padding: '4px 10px', borderRadius: 999 }}>
              Piano: {usage.plan}
            </span>
          )}
          <Btn variant="secondary" onClick={load} disabled={loading}>
            {loading ? '...' : 'Aggiorna'}
          </Btn>
        </div>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#DC2626', padding: '10px 12px', background: '#FEF2F2', borderRadius: 8 }}>
          Errore: {error}
        </div>
      )}

      {loading && !usage && (
        <div style={{ fontSize: 12, color: '#94A3B8', padding: '10px 0' }}>Caricamento...</div>
      )}

      {usage && (
        <>
          <CreditsBar credits={usage.credits} />
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', margin: '18px 0 8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Breakdown utilizzo
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <MiniStat
              label="Storage"
              primary={formatBytes(usage.storage?.usage)}
              secondary={`${formatCredits(usage.storage?.credits_usage)} crediti`}
            />
            <MiniStat
              label="Bandwidth (mese)"
              primary={formatBytes(usage.bandwidth?.usage)}
              secondary={`${formatCredits(usage.bandwidth?.credits_usage)} crediti`}
            />
            <MiniStat
              label="Transformations (mese)"
              primary={formatNumber(usage.transformations?.usage)}
              secondary={`${formatCredits(usage.transformations?.credits_usage)} crediti`}
            />
            <MiniStat
              label="Risorse totali"
              primary={formatNumber(usage.resources)}
              secondary={`${formatNumber(usage.derived_resources)} derivate`}
            />
          </div>
        </>
      )}

      {usage?.last_updated && (
        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 12 }}>
          Ultimo aggiornamento Cloudinary: {usage.last_updated}
        </div>
      )}
    </Card>
  )
}

function CreditsBar({ credits }) {
  const used = credits?.usage ?? 0
  const limit = credits?.limit ?? 25
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const barColor = pct >= 90 ? '#DC2626' : pct >= 70 ? '#F59E0B' : ACCENT
  const hint = pct >= 90 ? 'Piano quasi saturo — valuta upgrade'
    : pct >= 70 ? 'Attenzione: utilizzo elevato'
    : 'Utilizzo nella norma'
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>CREDITI MENSILI</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginTop: 2 }}>
            {formatCredits(used)} <span style={{ color: '#94A3B8', fontWeight: 500, fontSize: 14 }}>/ {limit}</span>
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: barColor }}>{pct.toFixed(1)}%</div>
      </div>
      <div style={{ height: 8, background: '#E8ECF1', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, transition: 'width 0.3s' }} />
      </div>
      <div style={{ fontSize: 11, color: barColor, marginTop: 8, fontWeight: 500 }}>{hint}</div>
    </div>
  )
}

function MiniStat({ label, primary, secondary }) {
  return (
    <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginTop: 4 }}>{primary}</div>
      <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{secondary}</div>
    </div>
  )
}

function formatBytes(b) {
  if (b == null) return '—'
  if (b === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(1024))
  return `${(b / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

function formatNumber(n) {
  if (n == null) return '—'
  return n.toLocaleString('it-IT')
}

function formatCredits(c) {
  if (c == null) return '—'
  return Number(c).toFixed(2)
}

// ═══════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════

const labelStyle = { fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 4, display: 'block' }
const dateInputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #E8ECF1', fontSize: 13, color: '#1a1a1a', background: '#fff', outline: 'none' }
const iconBtn = { width: 34, height: 34, borderRadius: 8, border: '1px solid #E8ECF1', background: '#F8FAFC', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const sectionTitle = { fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }
