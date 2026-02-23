// ═══════════════════════════════════════════
// CONSTANTS & HELPERS
// ═══════════════════════════════════════════

export const DEPTS = [
  { id: 'concept', label: 'Concept', icon: '🎨' },
  { id: 'modeling', label: 'Modeling', icon: '🧊' },
  { id: 'texturing', label: 'Texturing', icon: '🖌' },
  { id: 'rigging', label: 'Rigging', icon: '🦴' },
  { id: 'animation', label: 'Animation', icon: '🎬' },
  { id: 'compositing', label: 'Comp', icon: '✨' },
]

export const SHOT_STATUSES = [
  { id: 'not_started', label: 'To Do', color: '#555', bg: '#1e1e28' },
  { id: 'in_progress', label: 'WIP', color: '#6ea8fe', bg: '#182638' },
  { id: 'review', label: 'Review', color: '#f0c36d', bg: '#2a2518' },
  { id: 'needs_revision', label: 'Fix', color: '#f07070', bg: '#281818' },
  { id: 'approved', label: 'Done', color: '#6ee7a0', bg: '#18281e' },
]

export const TASK_STATUSES = [
  { id: 'todo', label: 'To Do', color: '#555', bg: '#1e1e28' },
  { id: 'wip', label: 'WIP', color: '#6ea8fe', bg: '#182638' },
  { id: 'review', label: 'Review', color: '#f0c36d', bg: '#2a2518' },
  { id: 'approved', label: 'Done', color: '#6ee7a0', bg: '#18281e' },
]

export const MOOD_EMOJIS = ['😊','😎','🤔','😴','🔥','💪','😤','🎉','😢','🤯','🧠','☕','🎯','💡','😇','🚀','🎮','🖥','📚','🌙']

export const getShotStatus = (id) => SHOT_STATUSES.find(s => s.id === id) || SHOT_STATUSES[0]
export const getTaskStatus = (id) => TASK_STATUSES.find(s => s.id === id) || TASK_STATUSES[0]
export const isStaff = (role) => role && role !== 'studente'
