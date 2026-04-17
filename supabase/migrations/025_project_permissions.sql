-- ============================================
-- 025: Project-level permissions & roles
-- ============================================

-- Add permission columns to project_members
ALTER TABLE project_members
  ADD COLUMN project_role text DEFAULT NULL,
  ADD COLUMN can_manage_members boolean DEFAULT false NOT NULL,
  ADD COLUMN can_manage_shots boolean DEFAULT false NOT NULL,
  ADD COLUMN can_manage_tasks boolean DEFAULT false NOT NULL,
  ADD COLUMN can_review boolean DEFAULT false NOT NULL;

-- Backfill: give all current staff members full permissions
UPDATE project_members pm
SET
  can_manage_members = true,
  can_manage_shots = true,
  can_manage_tasks = true,
  can_review = true
FROM profiles p
WHERE pm.user_id = p.id
  AND p.role IN ('admin', 'super_admin', 'docente', 'coordinatore');

-- Backfill: copy global department to project_role for students
UPDATE project_members pm
SET project_role = p.department
FROM profiles p
WHERE pm.user_id = p.id
  AND p.role = 'studente'
  AND p.department IS NOT NULL;

-- RLS: Allow admins and members with can_manage_members to UPDATE project_members
CREATE POLICY "pm_update_admin_or_manager" ON project_members
  FOR UPDATE USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM project_members pm2
      WHERE pm2.project_id = project_members.project_id
        AND pm2.user_id = auth.uid()
        AND pm2.can_manage_members = true
    )
  );

-- Allow members with can_manage_members to insert students
CREATE POLICY "pm_member_manager_insert" ON project_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm2
      WHERE pm2.project_id = project_members.project_id
        AND pm2.user_id = auth.uid()
        AND pm2.can_manage_members = true
    )
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = project_members.user_id AND role = 'studente'
    )
  );

-- Allow members with can_manage_members to delete students
CREATE POLICY "pm_member_manager_delete" ON project_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_members pm2
      WHERE pm2.project_id = project_members.project_id
        AND pm2.user_id = auth.uid()
        AND pm2.can_manage_members = true
    )
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = project_members.user_id AND role = 'studente'
    )
  );
