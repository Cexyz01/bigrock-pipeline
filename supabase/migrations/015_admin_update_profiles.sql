-- ============================================
-- 015: Allow admins to update other profiles' roles
-- ============================================

-- Admin/Super Admin can update any profile (role, department, etc.)
CREATE POLICY "admin_update_profiles" ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
