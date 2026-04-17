-- ============================================
-- 028: Remove unused permission columns + update RLS
-- ============================================

-- Drop policies that depend on can_manage_members
DROP POLICY IF EXISTS "pm_update_admin_or_manager" ON project_members;
DROP POLICY IF EXISTS "pm_member_manager_insert" ON project_members;
DROP POLICY IF EXISTS "pm_member_manager_delete" ON project_members;

-- Drop unused columns
ALTER TABLE project_members DROP COLUMN IF EXISTS can_manage_tasks;
ALTER TABLE project_members DROP COLUMN IF EXISTS can_manage_members;

-- Recreate UPDATE policy: admin or project manager can update
CREATE POLICY "pm_update_admin_or_manager" ON project_members
  FOR UPDATE USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM project_members pm2
      WHERE pm2.project_id = project_members.project_id
        AND pm2.user_id = auth.uid()
        AND pm2.can_manage_project = true
    )
  );

-- Project managers can add students
CREATE POLICY "pm_manager_insert" ON project_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members pm2
      WHERE pm2.project_id = project_members.project_id
        AND pm2.user_id = auth.uid()
        AND pm2.can_manage_project = true
    )
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = project_members.user_id AND role = 'studente'
    )
  );

-- Project managers can remove students
CREATE POLICY "pm_manager_delete" ON project_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM project_members pm2
      WHERE pm2.project_id = project_members.project_id
        AND pm2.user_id = auth.uid()
        AND pm2.can_manage_project = true
    )
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = project_members.user_id AND role = 'studente'
    )
  );
