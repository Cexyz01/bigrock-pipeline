// ═══════════════════════════════════════════
// CONSTANTS & HELPERS
// ═══════════════════════════════════════════

export const DEPTS = [
  { id: 'concept', label: 'Concept', icon: '🎨', color: '#ff6b6b' },
  { id: 'modeling', label: 'Modeling', icon: '🧊', color: '#7c5cfc' },
  { id: 'texturing', label: 'Texturing', icon: '🖌', color: '#f0c36d' },
  { id: 'rigging', label: 'Rigging', icon: '🦴', color: '#4ecdc4' },
  { id: 'animation', label: 'Animation', icon: '🎬', color: '#ff8e53' },
  { id: 'compositing', label: 'Comp', icon: '✨', color: '#a78bfa' },
]

export const SHOT_STATUSES = [
  { id: 'not_started', label: 'To Do', color: '#555', bg: '#1e1e28' },
  { id: 'in_progress', label: 'WIP', color: '#7c5cfc', bg: '#1c1836' },
  { id: 'review', label: 'Review', color: '#f0c36d', bg: '#2a2518' },
  { id: 'needs_revision', label: 'Fix', color: '#ff6b6b', bg: '#281818' },
  { id: 'approved', label: 'Done', color: '#4ecdc4', bg: '#14282a' },
]

export const TASK_STATUSES = [
  { id: 'todo', label: 'To Do', color: '#555', bg: '#1e1e28' },
  { id: 'wip', label: 'WIP', color: '#7c5cfc', bg: '#1c1836' },
  { id: 'review', label: 'Review', color: '#f0c36d', bg: '#2a2518' },
  { id: 'approved', label: 'Done', color: '#4ecdc4', bg: '#14282a' },
]

export const MOOD_EMOJIS = ['😊','😎','🤔','😴','🔥','💪','😤','🎉','😢','🤯','🧠','☕','🎯','💡','😇','🚀','🎮','🖥','📚','🌙']

export const CHAT_EMOJIS = ['😊','😂','🤣','😍','🥳','😎','🤔','😅','👍','👎','❤️','🔥','💯','✅','🎉','🚀','💪','👏','🙏','😭','😤','🤯','💡','⭐','🎯','🏆','💀','🫡','🤝','👀']

export const getShotStatus = (id) => SHOT_STATUSES.find(s => s.id === id) || SHOT_STATUSES[0]
export const getTaskStatus = (id) => TASK_STATUSES.find(s => s.id === id) || TASK_STATUSES[0]
export const isStaff = (role) => role && role !== 'studente'

// Accent colors
export const ACCENT = '#7c5cfc'
export const ACCENT_LIGHT = '#a78bfa'
export const ACCENT_BG = 'rgba(124,92,252,0.12)'
export const ACCENT_BORDER = 'rgba(124,92,252,0.25)'
