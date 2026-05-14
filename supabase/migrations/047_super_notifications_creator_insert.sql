-- Manager tab in "Gestione" is now gated by `create_projects` permission
-- instead of admin-only. Mirror that on the RLS so the insert actually works
-- for users with that permission (previously only is_admin() could insert,
-- which raised "row-level security policy" errors for non-admin managers).

DROP POLICY IF EXISTS "sn_insert_admin" ON super_notifications;

CREATE POLICY "sn_insert_creator" ON super_notifications
  FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'create_projects'));
