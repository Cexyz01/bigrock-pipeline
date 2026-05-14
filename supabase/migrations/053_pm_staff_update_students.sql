-- Let staff (docente, coordinatore, etc.) update project_members rows for
-- students — specifically so professors can change the per-project
-- department (project_role). Admins keep their unconditional UPDATE.
--
-- Previously only `pm_update_perms` existed and required is_admin().

DROP POLICY IF EXISTS "pm_update_perms" ON project_members;
DROP POLICY IF EXISTS "pm_admin_update" ON project_members;
DROP POLICY IF EXISTS "pm_staff_update_students" ON project_members;

CREATE POLICY "pm_admin_update" ON project_members
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "pm_staff_update_students" ON project_members
  FOR UPDATE TO authenticated
  USING (
    is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = project_members.user_id
        AND profiles.role = 'studente'
    )
  )
  WITH CHECK (
    is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = project_members.user_id
        AND profiles.role = 'studente'
    )
  );

NOTIFY pgrst, 'reload schema';
