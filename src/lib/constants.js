// =============================================
// CONSTANTS & HELPERS
// =============================================

export const DEPTS = [
  { id: 'concept', label: 'Concept', icon: '🎨', color: '#FF6B4A' },
  { id: 'modeling', label: 'Modeling', icon: '🧊', color: '#CDFF00' },
  { id: 'texturing', label: 'Texturing', icon: '🖌', color: '#f0c36d' },
  { id: 'rigging', label: 'Rigging', icon: '🦴', color: '#4ECDC4' },
  { id: 'animation', label: 'Animation', icon: '🎬', color: '#FF6B4A' },
  { id: 'compositing', label: 'Comp', icon: '✨', color: '#C4A8FF' },
]

export const SHOT_STATUSES = [
  { id: 'not_started', label: 'To Do', color: '#555', bg: '#141420' },
  { id: 'in_progress', label: 'WIP', color: '#CDFF00', bg: '#1a1e10' },
  { id: 'review', label: 'Review', color: '#f0c36d', bg: '#2a2518' },
  { id: 'needs_revision', label: 'Fix', color: '#FF6B4A', bg: '#281818' },
  { id: 'approved', label: 'Done', color: '#4ECDC4', bg: '#0f2624' },
]

export const TASK_STATUSES = [
  { id: 'todo', label: 'To Do', color: '#555', bg: '#141420' },
  { id: 'wip', label: 'WIP', color: '#CDFF00', bg: '#1a1e10' },
  { id: 'review', label: 'Review', color: '#f0c36d', bg: '#2a2518' },
  { id: 'approved', label: 'Done', color: '#4ECDC4', bg: '#0f2624' },
]

export const MOOD_EMOJIS = ['😊','😎','🤔','😴','🔥','💪','😤','🎉','😢','🤯','🧠','☕','🎯','💡','😇','🚀','🎮','🖥','📚','🌙']

export const CHAT_EMOJIS = ['😊','😂','🤣','😍','🥳','😎','🤔','😅','👍','👎','❤️','🔥','💯','✅','🎉','🚀','💪','👏','🙏','😭','😤','🤯','💡','⭐','🎯','🏆','💀','🫡','🤝','👀']

export const getShotStatus = (id) => SHOT_STATUSES.find(s => s.id === id) || SHOT_STATUSES[0]
export const getTaskStatus = (id) => TASK_STATUSES.find(s => s.id === id) || TASK_STATUSES[0]
export const isStaff = (role) => role && role !== 'studente'

// Accent colors
export const ACCENT = '#CDFF00'
export const ACCENT_LIGHT = '#d8ff4d'
export const ACCENT_BG = 'rgba(205,255,0,0.10)'
export const ACCENT_BORDER = 'rgba(205,255,0,0.25)'
