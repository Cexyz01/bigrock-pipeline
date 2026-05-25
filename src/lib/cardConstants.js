// =============================================
// CARD CONSTANTS — Single source of truth for TCG visuals
// =============================================
// Rarity colors, canonical card dimensions, timings and tokens for
// the entire pack/card subsystem live here. Do NOT re-define these
// inline in CardRenderer / PackCard / PackAdminPanel.

export const RARITY_COLORS = {
  common:  { border: '#64748B', glow: 'rgba(100,116,139,0.3)', label: 'Common',  bg: '#2d2d2d' },
  rare:    { border: '#22C55E', glow: 'rgba(34,197,94,0.35)',  label: 'Rare',    bg: '#14532D' },
  gold:    { border: '#F5A623', glow: 'rgba(245,166,35,0.45)', label: 'Gold',    bg: '#422006' },
  diamond: { border: '#06B6D4', glow: 'rgba(6,182,212,0.35)',  label: 'Diamond', bg: '#083344' },
  rainbow: { border: '#EC4899', glow: 'rgba(236,72,153,0.4)',  label: 'Rainbow', bg: '#500724' },
}

// Canonical render size — card is always rendered at this size, then CSS-scaled
export const CARD_W = 300
export const CARD_H = 420
export const CARD_ASPECT = '2.5 / 3.5'

// Card depth — actual side faces rendered as skewed divs
export const CARD_DEPTH = 3
export const DEPTH_LAYERS = [
  { depth: 0.33, factor: 0.75 },
  { depth: 0.66, factor: 0.55 },
  { depth: 1.0,  factor: 0.35 },
]

// Tilt 3D ranges (max degrees) and animation timing
export const TILT_MAX_DEG = 15
export const TILT_RETURN_MS = 180

// Pack open time window during active TCG game
// 9:30 = 570 min, 18:10 = 1090 min
export const PACK_WINDOW_START_MIN = 9 * 60 + 30
export const PACK_WINDOW_END_MIN = 18 * 60 + 10
export const PACK_WINDOW_LABEL = '9:30 alle 18:10'

// Grid layout
export const GRID_CARD_MIN_DESKTOP = 210
export const GRID_CARD_MIN_MOBILE = 90
export const GRID_GAP_DESKTOP = 12
export const GRID_GAP_MOBILE = 8

// Theme tokens used across the TCG views
export const TCG_THEME = {
  bg: '#1a1a1a',
  card: '#222222',
  border: '#2d2d2d',
  text: '#F1F5F9',
  sub: '#CBD5E1',
  muted: '#94A3B8',
  dim: '#64748B',
}
