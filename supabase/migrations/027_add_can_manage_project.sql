-- ============================================
-- 027: Add can_manage_project permission
-- ============================================

ALTER TABLE project_members
  ADD COLUMN can_manage_project boolean DEFAULT false NOT NULL;

-- Backfill: admins get this permission on all projects
UPDATE project_members pm
SET can_manage_project = true
FROM profiles p
WHERE pm.user_id = p.id
  AND p.role IN ('admin', 'super_admin');
