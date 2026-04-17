-- ============================================
-- 034: Align projects/shots RLS with role permissions
-- ============================================
-- Previously projects UPDATE and shots DELETE required is_admin(),
-- which (post-033) only matches roles with manage_roles permission.
-- Custom roles like "Producer" with manage_project_settings / delete_shots
-- were being silently blocked by RLS even though the UI allowed the action.
--
-- This migration switches those two policies to has_permission() checks,
-- so any role with the appropriate permission flag works.

-- ── projects: UPDATE ────────────────────────────────────────
DROP POLICY IF EXISTS "projects_update" ON projects;

CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (
    has_permission(auth.uid(), 'manage_project_settings')
  );

-- ── shots: DELETE ───────────────────────────────────────────
DROP POLICY IF EXISTS "shots_delete_project" ON shots;

CREATE POLICY "shots_delete_project" ON shots
  FOR DELETE USING (
    is_project_member(project_id, auth.uid())
    AND has_permission(auth.uid(), 'delete_shots')
  );
