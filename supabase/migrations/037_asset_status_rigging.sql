-- ============================================
-- 037: Add status_rigging to assets
-- ============================================
-- Rigging is now an asset-level department (not a shot department).

ALTER TABLE assets ADD COLUMN IF NOT EXISTS status_rigging shot_status DEFAULT 'not_started';
