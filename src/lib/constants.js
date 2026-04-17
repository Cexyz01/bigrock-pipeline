// =============================================
// CONSTANTS — Light Theme Design System
// =============================================

export const DEPTS = [
  { id: 'concept',      label: 'Concept',         color: '#E879F9' },
  { id: 'modeling',      label: 'Modeling',        color: '#A78BFA' },
  { id: 'texturing',     label: 'Texturing',       color: '#F59E0B' },
  { id: 'rigging',       label: 'Rigging',         color: '#34D399' },
  { id: 'animation',     label: 'Animation',       color: '#F87171' },
  { id: 'compositing',   label: 'Comp',            color: '#60A5FA' },
  { id: 'lighting',      label: 'Light & Render',  color: '#FBBF24' },
  { id: 'test_ai',       label: 'Test AI',         color: '#8B5CF6' },
  { id: 'sound',         label: 'Sound',           color: '#14B8A6' },
]

export const isDeptEnabled = (shot, deptId) => !shot.disabled_depts?.[deptId]
export const AUDIO_EXTS = ['mp3','wav','ogg','aac','m4a','flac']
export const isAudioUrl = (url) => {
  if (!url) return false
  // Strip query params for extension check
  const clean = url.split('?')[0].toLowerCase()
  return AUDIO_EXTS.some(ext => clean.endsWith(`.${ext}`))
}
export const VIDEO_EXTS = ['mp4','webm','mov','avi','mkv','m4v']
export const isVideoUrl = (url) => {
  if (!url) return false
  const clean = url.split('?')[0].toLowerCase()
  return VIDEO_EXTS.some(ext => clean.endsWith(`.${ext}`))
}

export const SHOT_STATUSES = [
  { id: 'not_started', label: 'To Do', color: '#94A3B8', bg: '#E2E8F0' },
  { id: 'in_progress', label: 'WIP', color: '#2563EB', bg: '#BFDBFE' },
  { id: 'review', label: 'Complete', color: '#2563EB', bg: '#A7F3D0' },
  { id: 'approved', label: 'Done', color: '#059669', bg: '#A7F3D0' },
]

export const TASK_STATUSES = [
  { id: 'todo', label: 'To Do', color: '#94A3B8', bg: '#E2E8F0' },
  { id: 'wip', label: 'WIP', color: '#2563EB', bg: '#BFDBFE' },
  { id: 'review', label: 'Review', color: '#D97706', bg: '#FDE68A' },
  { id: 'approved', label: 'Done', color: '#059669', bg: '#A7F3D0' },
]

export const MOOD_EMOJIS = ['😊','😎','🤔','😴','🔥','💪','🎉','🧠','☕','🎯','💡','🚀','🎮','📚','🌙','⚡','🌈','🍀','🎵','✨']

export const CHAT_EMOJIS = ['👍','👎','😂','🤣','💀','🫡','🗿','😭','🥲','🤡','👀','🫠','💅','🤌','🙃','😤','🤯','🥵','🫣','🤫','😈','👻','🦾','🧃','🍿','🎬','🎨','🖥️','⚡','🛠️','🔧','📐','🎭','🪄','💎','🏆','🧊','☠️','🌀','🫧']

export const getShotStatus = (id) => SHOT_STATUSES.find(s => s.id === id) || SHOT_STATUSES[0]
export const getTaskStatus = (id) => TASK_STATUSES.find(s => s.id === id) || TASK_STATUSES[0]

// Protected super admin accounts — role cannot be changed
export const SUPER_ADMIN_EMAILS = ['davide.casinelli@bigrock.it', 'emanuele.cerni@bigrock.it']
export const SUPER_ADMIN_EMAIL = 'davide.casinelli@bigrock.it' // legacy compat

// ── Permission Catalog (18 granular permissions) ──
export const PERMISSION_CATALOG = [
  { category: 'Gestione Utenti', permissions: [
    { id: 'manage_roles', label: 'Gestione ruoli', desc: 'Creare, modificare e assegnare ruoli' },
    { id: 'manage_users', label: 'Gestione utenti', desc: 'Modificare profili di altri utenti' },
  ]},
  { category: 'Gestione Progetti', permissions: [
    { id: 'create_projects', label: 'Creare progetti', desc: 'Creare nuovi progetti' },
    { id: 'delete_projects', label: 'Eliminare progetti', desc: 'Eliminare progetti esistenti' },
    { id: 'manage_project_settings', label: 'Impostazioni progetto', desc: 'Modificare dettagli progetto' },
    { id: 'manage_project_members', label: 'Gestione membri', desc: 'Aggiungere/rimuovere membri' },
  ]},
  { category: 'Shots', permissions: [
    { id: 'create_edit_shots', label: 'Creare/modificare shots', desc: 'Creare e modificare shots' },
    { id: 'delete_shots', label: 'Eliminare shots', desc: 'Eliminare shots esistenti' },
    { id: 'upload_media', label: 'Upload media', desc: 'Caricare immagini e video' },
  ]},
  { category: 'Tasks', permissions: [
    { id: 'create_edit_tasks', label: 'Creare/modificare tasks', desc: 'Creare e modificare tasks' },
    { id: 'delete_tasks', label: 'Eliminare tasks', desc: 'Eliminare tasks esistenti' },
  ]},
  { category: 'Review & Monitoraggio', permissions: [
    { id: 'access_review', label: 'Review page', desc: 'Accesso alla pagina di review' },
    { id: 'access_timeline', label: 'Timeline', desc: 'Accesso alla timeline' },
    { id: 'access_activity', label: 'Activity tracker', desc: 'Accesso al tracker attività' },
  ]},
  { category: 'Altro', permissions: [
    { id: 'manage_calendar', label: 'Gestione calendario', desc: 'Creare/eliminare eventi' },
    { id: 'manage_tcg', label: 'TCG / Pack admin', desc: 'Pannello admin del gioco di carte' },
    { id: 'send_notifications', label: 'Super notifiche', desc: 'Inviare notifiche forzate' },
    { id: 'access_admin_console', label: 'Admin console', desc: 'Accesso alla console admin' },
  ]},
]

// All permission IDs flat list
export const ALL_PERMISSION_IDS = PERMISSION_CATALOG.flatMap(c => c.permissions.map(p => p.id))

// ── New permission-based helpers ──
export const isSuperAdmin = (user) => {
  if (!user) return false
  // Accept either user object or email string
  const email = typeof user === 'object' ? user.email : null
  if (email && SUPER_ADMIN_EMAILS.includes(email)) return true
  // Legacy: accept role string
  if (typeof user === 'string') return user === 'super_admin'
  return SUPER_ADMIN_EMAILS.includes(user?.email)
}

export const hasPermission = (user, perm) => {
  if (!user) return false
  if (SUPER_ADMIN_EMAILS.includes(user.email)) return true
  return !!user.role_permissions?.[perm]
}

// Backward-compatible: accepts string (legacy) or user object (new)
export const isStaff = (roleOrUser) => {
  if (!roleOrUser) return false
  if (typeof roleOrUser === 'object') {
    if (SUPER_ADMIN_EMAILS.includes(roleOrUser.email)) return true
    return roleOrUser.role_slug ? roleOrUser.role_slug !== 'studente' : (roleOrUser.role && roleOrUser.role !== 'studente')
  }
  return roleOrUser !== 'studente'
}

export const isAdmin = (roleOrUser) => {
  if (!roleOrUser) return false
  if (typeof roleOrUser === 'object') {
    if (SUPER_ADMIN_EMAILS.includes(roleOrUser.email)) return true
    return !!roleOrUser.role_permissions?.manage_roles
  }
  return roleOrUser === 'admin' || roleOrUser === 'super_admin'
}

export const displayRole = (roleOrUser) => {
  if (typeof roleOrUser === 'object' && roleOrUser?.role_name) return roleOrUser.role_name
  const role = typeof roleOrUser === 'string' ? roleOrUser : roleOrUser?.role
  const ROLE_MAP = { super_admin: 'Super Admin', admin: 'Admin', docente: 'Docente', coordinatore: 'Coordinatore', studente: 'Studente' }
  return ROLE_MAP[role] || role || 'Studente'
}

// Pack rarity tiers (ordered by rarity descending)
// Per-pool: 2 Rainbow + 4 Diamond + 6 Gold + 8 Rare + 20 Common = 40 cards
export const PACK_RARITIES = [
  { id: 'rainbow',  label: 'Rainbow',  color: '#EC4899', perPool: 2,  total: 6  },
  { id: 'diamond',  label: 'Diamond',  color: '#06B6D4', perPool: 4,  total: 12 },
  { id: 'gold',     label: 'Gold',     color: '#F59E0B', perPool: 6,  total: 18 },
  { id: 'rare',     label: 'Rare',     color: '#3B82F6', perPool: 8,  total: 24 },
  { id: 'common',   label: 'Common',   color: '#94A3B8', perPool: 20, total: 60 },
]

export const NON_COMMON_RARITIES = ['rainbow', 'diamond', 'gold', 'rare']

// 3 pack pools — each pool has 40 exclusive cards, 3333 packs
// Cards numbered by rarity blocks: Rainbow 000-005, Diamond 006-017, Gold 018-035, Rare 036-059, Common 060-119
export const PACK_TYPES = [
  { id: 'red',   label: 'Red',   color: '#EF4444', accent: '#DC2626', bg: '#991B1B', image: '/packs/pack_red.png', titleImage: '/images/red_pack_title.png' },
  { id: 'green', label: 'Green', color: '#22C55E', accent: '#16A34A', bg: '#166534', image: '/packs/pack_green.png', titleImage: '/images/green_pack_title.png' },
  { id: 'blue',  label: 'Blue',  color: '#3B82F6', accent: '#2563EB', bg: '#1E3A5F', image: '/packs/pack_blue.png', titleImage: '/images/blue_pack_title.png' },
]

export const PACK_TOTAL = 9999
export const PACKS_PER_POOL = 3333
export const CARDS_PER_PACK = 4
export const PACK_TIMER_MINUTES = 60
export const PACK_MAX_ACCUMULATED = 3

// Timeline defaults
export const DEFAULT_FPS = 24
export const DEFAULT_DURATION_FRAMES = 120

// Design tokens
export const ACCENT = '#F28C28'
export const ACCENT_LIGHT = '#F5B862'
export const ACCENT_BG = 'rgba(242,140,40,0.06)'
export const ACCENT_BORDER = 'rgba(242,140,40,0.15)'
