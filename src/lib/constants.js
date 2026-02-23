// =============================================
// CONSTANTS & HELPERS
// =============================================

export const DEPTS = [
  { id: 'concept', label: 'Concept', icon: '🎨', color: '#FFB8A1' },
  { id: 'modeling', label: 'Modeling', icon: '🧊', color: '#C5B3E6' },
  { id: 'texturing', label: 'Texturing', icon: '🖌', color: '#FFEAA7' },
  { id: 'rigging', label: 'Rigging', icon: '🦴', color: '#88D8C0' },
  { id: 'animation', label: 'Animation', icon: '🎬', color: '#FFB7B2' },
  { id: 'compositing', label: 'Comp', icon: '✨', color: '#9DC4E8' },
]

export const SHOT_STATUSES = [
  { id: 'not_started', label: 'To Do', color: '#606080', bg: '#1c1c35' },
  { id: 'in_progress', label: 'WIP', color: '#9DC4E8', bg: 'rgba(157,196,232,0.10)' },
  { id: 'review', label: 'Review', color: '#FFEAA7', bg: 'rgba(255,234,167,0.10)' },
  { id: 'needs_revision', label: 'Fix', color: '#FFB7B2', bg: 'rgba(255,183,178,0.10)' },
  { id: 'approved', label: 'Done', color: '#A8E6CF', bg: 'rgba(168,230,207,0.10)' },
]

export const TASK_STATUSES = [
  { id: 'todo', label: 'To Do', color: '#606080', bg: '#1c1c35' },
  { id: 'wip', label: 'WIP', color: '#9DC4E8', bg: 'rgba(157,196,232,0.10)' },
  { id: 'review', label: 'Review', color: '#FFEAA7', bg: 'rgba(255,234,167,0.10)' },
  { id: 'approved', label: 'Done', color: '#A8E6CF', bg: 'rgba(168,230,207,0.10)' },
]

export const MOOD_EMOJIS = ['😊','😎','🤔','😴','🔥','💪','😤','🎉','😢','🤯','🧠','☕','🎯','💡','😇','🚀','🎮','🖥','📚','🌙']

export const CHAT_EMOJIS = ['😊','😂','🤣','😍','🥳','😎','🤔','😅','👍','👎','❤️','🔥','💯','✅','🎉','🚀','💪','👏','🙏','😭','😤','🤯','💡','⭐','🎯','🏆','💀','🫡','🤝','👀']

export const getShotStatus = (id) => SHOT_STATUSES.find(s => s.id === id) || SHOT_STATUSES[0]
export const getTaskStatus = (id) => TASK_STATUSES.find(s => s.id === id) || TASK_STATUSES[0]
export const isStaff = (role) => role && role !== 'studente'

// Accent colors — pastel lavender theme
export const ACCENT = '#C5B3E6'
export const ACCENT_LIGHT = '#d4c6ee'
export const ACCENT_BG = 'rgba(197,179,230,0.10)'
export const ACCENT_BORDER = 'rgba(197,179,230,0.25)'
