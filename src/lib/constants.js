// =============================================
// CONSTANTS — Light Theme Design System
// =============================================

export const DEPTS = [
  { id: 'concept', label: 'Concept', color: '#E879F9' },
  { id: 'modeling', label: 'Modeling', color: '#A78BFA' },
  { id: 'texturing', label: 'Texturing', color: '#F59E0B' },
  { id: 'rigging', label: 'Rigging', color: '#34D399' },
  { id: 'animation', label: 'Animation', color: '#F87171' },
  { id: 'compositing', label: 'Comp', color: '#60A5FA' },
]

export const SHOT_STATUSES = [
  { id: 'not_started', label: 'To Do', color: '#94A3B8', bg: '#E2E8F0' },
  { id: 'in_progress', label: 'WIP', color: '#2563EB', bg: '#BFDBFE' },
  { id: 'review', label: 'Review', color: '#D97706', bg: '#FDE68A' },
  { id: 'needs_revision', label: 'Fix', color: '#DC2626', bg: '#FECACA' },
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
export const isStaff = (role) => role && role !== 'studente'
export const isAdmin = (role) => role === 'admin' || role === 'super_admin'
export const isSuperAdmin = (role) => role === 'super_admin'
export const displayRole = (role) => {
  const ROLE_MAP = { super_admin: 'Admin', admin: 'Admin', docente: 'Teacher', coordinatore: 'Coordinator', studente: 'Student' }
  return ROLE_MAP[role] || role
}

// Protected super admin account — role cannot be changed from Crew page
export const SUPER_ADMIN_EMAIL = 'davide.casinelli@bigrock.it'

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

// Design tokens
export const ACCENT = '#6C5CE7'
export const ACCENT_LIGHT = '#A29BFE'
export const ACCENT_BG = 'rgba(108,92,231,0.06)'
export const ACCENT_BORDER = 'rgba(108,92,231,0.15)'
