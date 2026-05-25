-- ============================================
-- 065: Project Script (Sceneggiatura)
-- ============================================
-- Adds a free-text "script" column to projects so producers/admins
-- can store the project's screenplay and other team members can
-- read it from the Overview page.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS script text DEFAULT '';
