-- Make the super_notifications insert policy more resilient and explicit.
-- Adds an is_admin() fallback in case a long-lived admin session predates
-- the create_projects-based policy, and scopes it to `authenticated` so the
-- policy doesn't get evaluated for anonymous requests (which would lead
-- the same misleading "violates row-level security policy" error when the
-- JWT is somehow missing).

DROP POLICY IF EXISTS "sn_insert_creator" ON super_notifications;

CREATE POLICY "sn_insert_creator" ON super_notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      has_permission(auth.uid(), 'create_projects')
      OR is_admin(auth.uid())
    )
  );

NOTIFY pgrst, 'reload schema';
