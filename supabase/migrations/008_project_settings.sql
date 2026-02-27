-- ============================================
-- App Settings — key/value config table
-- ============================================

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "settings_select" ON app_settings FOR SELECT USING (true);

-- Only staff can insert/update/delete
CREATE POLICY "settings_staff_insert" ON app_settings FOR INSERT WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "settings_staff_update" ON app_settings FOR UPDATE USING (is_staff(auth.uid()));
CREATE POLICY "settings_staff_delete" ON app_settings FOR DELETE USING (is_staff(auth.uid()));

-- Seed the project_start_date key (empty = no filtering)
INSERT INTO app_settings (key, value) VALUES ('project_start_date', '')
ON CONFLICT (key) DO NOTHING;
