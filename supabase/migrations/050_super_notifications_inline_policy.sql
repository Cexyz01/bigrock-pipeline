-- Final shape for the super_notifications insert policy. Replaces the
-- has_permission()/is_admin() function calls with an inline EXISTS so we
-- aren't depending on SECURITY DEFINER function caching, and accepts any of:
--   - hardcoded super admin emails
--   - role with create_projects = true
--   - role with manage_roles = true (admin role)

DROP POLICY IF EXISTS "sn_insert_creator" ON super_notifications;

CREATE POLICY "sn_insert_creator" ON super_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
        FROM profiles p
        LEFT JOIN roles r ON r.id = p.role_id
       WHERE p.id = auth.uid()
         AND (
           p.email IN ('davide.casinelli@bigrock.it', 'emanuele.cerni@bigrock.it')
           OR (r.permissions->>'create_projects')::boolean = true
           OR (r.permissions->>'manage_roles')::boolean = true
         )
    )
  );

NOTIFY pgrst, 'reload schema';
