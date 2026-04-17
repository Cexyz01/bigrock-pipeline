-- ============================================
-- 029: Add can_create_projects to profiles
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS can_create_projects boolean DEFAULT false NOT NULL;
