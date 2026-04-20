-- ============================================
-- 038: Add status_concept to assets
-- ============================================
-- Concept is now an asset-level department too.

ALTER TABLE assets ADD COLUMN IF NOT EXISTS status_concept shot_status DEFAULT 'not_started';
