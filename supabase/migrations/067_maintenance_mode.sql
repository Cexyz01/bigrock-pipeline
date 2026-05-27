-- ============================================
-- Maintenance Mode — admin-controlled site lockdown
-- ============================================
-- Stores the maintenance flag in app_settings (key='maintenance_mode',
-- value='on' | 'off'). All authenticated clients can SELECT it (the
-- existing settings_select policy already allows this), and we restore
-- the admin-only INSERT/UPDATE policies that were dropped some time ago.

-- Seed the row so getMaintenanceMode() never returns undefined.
INSERT INTO app_settings (key, value) VALUES ('maintenance_mode', 'off')
ON CONFLICT (key) DO NOTHING;

-- Idempotent re-create of admin write policies on app_settings.
-- Previous migration 008 created settings_staff_* policies, but only the
-- SELECT one survives in the current DB. We re-add INSERT/UPDATE/DELETE
-- using the canonical is_admin() helper so the maintenance toggle (and
-- the other app_settings flags) can be flipped by admins via the UI.
DROP POLICY IF EXISTS "settings_admin_insert" ON app_settings;
DROP POLICY IF EXISTS "settings_admin_update" ON app_settings;
DROP POLICY IF EXISTS "settings_admin_delete" ON app_settings;

CREATE POLICY "settings_admin_insert" ON app_settings
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "settings_admin_update" ON app_settings
  FOR UPDATE USING (is_admin());
CREATE POLICY "settings_admin_delete" ON app_settings
  FOR DELETE USING (is_admin());

-- Publish app_settings on the realtime channel so flipping the
-- maintenance flag propagates to all connected clients immediately
-- (no need to refresh — App.jsx subscribes via postgres_changes).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'app_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;
  END IF;
END $$;
