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

export const CHAT_EMOJIS = ['😊','😂','😍','🥳','😎','🤔','😅','👍','❤️','🔥','💯','✅','🎉','🚀','💪','👏','🙏','💡','⭐','🎯','🤝','👀','✨','🍕','💜','🫶','😌','🤩','🥰','💫']

export const getShotStatus = (id) => SHOT_STATUSES.find(s => s.id === id) || SHOT_STATUSES[0]
export const getTaskStatus = (id) => TASK_STATUSES.find(s => s.id === id) || TASK_STATUSES[0]
export const isStaff = (role) => role && role !== 'studente'

// Design tokens
export const ACCENT = '#6C5CE7'
export const ACCENT_LIGHT = '#A29BFE'
export const ACCENT_BG = 'rgba(108,92,231,0.06)'
export const ACCENT_BORDER = 'rgba(108,92,231,0.15)'
