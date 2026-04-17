-- ============================================
-- 026: Fix project_members SELECT policy
-- ============================================

-- Drop the old policy that uses auth.role() which can be unreliable
DROP POLICY IF EXISTS "pm_select" ON project_members;

-- Use auth.uid() IS NOT NULL instead — works for any authenticated user
CREATE POLICY "pm_select" ON project_members
  FOR SELECT USING (auth.uid() IS NOT NULL);
