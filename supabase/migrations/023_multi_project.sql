-- ============================================
-- 023: Multi-Project Support
-- ============================================

-- ── Helper functions is_staff() and is_admin() already exist in DB ──
-- Only create is_project_member below

-- ── Projects table ──────────────────────────────────────────

CREATE TABLE projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  miro_board_id text,
  start_date date,
  end_date date,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all projects (membership filtering is in-app)
CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (is_admin(auth.uid()));

CREATE POLICY "projects_delete" ON projects
  FOR DELETE USING (is_admin(auth.uid()));

-- Enable realtime
ALTER publication supabase_realtime ADD TABLE projects;

-- ── Project members table ───────────────────────────────────

CREATE TABLE project_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read memberships
CREATE POLICY "pm_select" ON project_members
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admins can insert/delete anyone
CREATE POLICY "pm_admin_insert" ON project_members
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "pm_admin_delete" ON project_members
  FOR DELETE USING (is_admin(auth.uid()));

-- Staff (docente/coordinatore) can insert/delete students only
CREATE POLICY "pm_staff_insert_students" ON project_members
  FOR INSERT WITH CHECK (
    is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = project_members.user_id AND role = 'studente'
    )
  );

CREATE POLICY "pm_staff_delete_students" ON project_members
  FOR DELETE USING (
    is_staff(auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = project_members.user_id AND role = 'studente'
    )
  );

-- Enable realtime
ALTER publication supabase_realtime ADD TABLE project_members;

-- Create indexes
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- ── Helper: check project membership (admins bypass) ────────

CREATE OR REPLACE FUNCTION is_project_member(p_project_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  IF is_admin(p_user_id) THEN RETURN true; END IF;
  RETURN EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ── Add project_id to existing tables ───────────────────────

-- Shots
ALTER TABLE shots ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;

-- Tasks
ALTER TABLE tasks ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;

-- Calendar events
ALTER TABLE calendar_events ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;

-- Notifications (nullable — some are global)
ALTER TABLE notifications ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE CASCADE;

-- ── Create default project + backfill ───────────────────────

INSERT INTO projects (id, name, description, miro_board_id, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Progetto Principale',
  'Progetto migrato automaticamente',
  'uXjVG8Pe7D4=',
  now()
);

-- Migrate start/end dates from app_settings
UPDATE projects SET
  start_date = CASE
    WHEN (SELECT value FROM app_settings WHERE key = 'project_start_date') IS NOT NULL
     AND (SELECT value FROM app_settings WHERE key = 'project_start_date') != ''
    THEN (SELECT value::date FROM app_settings WHERE key = 'project_start_date')
    ELSE NULL
  END,
  end_date = CASE
    WHEN (SELECT value FROM app_settings WHERE key = 'project_end_date') IS NOT NULL
     AND (SELECT value FROM app_settings WHERE key = 'project_end_date') != ''
    THEN (SELECT value::date FROM app_settings WHERE key = 'project_end_date')
    ELSE NULL
  END
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Assign all existing users as members of default project
INSERT INTO project_members (project_id, user_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM profiles
ON CONFLICT DO NOTHING;

-- Backfill project_id on all existing data
UPDATE shots SET project_id = '00000000-0000-0000-0000-000000000001' WHERE project_id IS NULL;
UPDATE tasks SET project_id = '00000000-0000-0000-0000-000000000001' WHERE project_id IS NULL;
UPDATE calendar_events SET project_id = '00000000-0000-0000-0000-000000000001' WHERE project_id IS NULL;

-- Now make NOT NULL
ALTER TABLE shots ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN project_id SET NOT NULL;
ALTER TABLE calendar_events ALTER COLUMN project_id SET NOT NULL;

-- Indexes for project_id
CREATE INDEX idx_shots_project ON shots(project_id);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_calendar_events_project ON calendar_events(project_id);
CREATE INDEX idx_notifications_project ON notifications(project_id);

-- ── Update RLS policies on shots ────────────────────────────

-- Drop any existing policies (names may vary)
DO $$ BEGIN
  -- Try common policy names
  EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "Enable update for authenticated users only" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "shots_select" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "shots_insert" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "shots_update" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "shots_delete" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated read" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated insert" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated update" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated delete" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can read shots" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "Staff can insert shots" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "Staff can update shots" ON shots';
  EXECUTE 'DROP POLICY IF EXISTS "Staff can delete shots" ON shots';
END $$;

CREATE POLICY "shots_select_project" ON shots
  FOR SELECT USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "shots_insert_project" ON shots
  FOR INSERT WITH CHECK (is_project_member(project_id, auth.uid()) AND is_staff(auth.uid()));

CREATE POLICY "shots_update_project" ON shots
  FOR UPDATE USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "shots_delete_project" ON shots
  FOR DELETE USING (is_project_member(project_id, auth.uid()) AND is_admin(auth.uid()));

-- ── Update RLS policies on tasks ────────────────────────────

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Enable update for authenticated users only" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "tasks_select" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "tasks_insert" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "tasks_update" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "tasks_delete" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated read" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated insert" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated update" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated delete" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated users can read tasks" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Staff can insert tasks" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Authenticated can update tasks" ON tasks';
  EXECUTE 'DROP POLICY IF EXISTS "Staff can delete tasks" ON tasks';
END $$;

CREATE POLICY "tasks_select_project" ON tasks
  FOR SELECT USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "tasks_insert_project" ON tasks
  FOR INSERT WITH CHECK (is_project_member(project_id, auth.uid()));

CREATE POLICY "tasks_update_project" ON tasks
  FOR UPDATE USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "tasks_delete_project" ON tasks
  FOR DELETE USING (is_project_member(project_id, auth.uid()) AND is_staff(auth.uid()));

-- ── Update RLS policies on calendar_events ──────────────────

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Enable read access for all users" ON calendar_events';
  EXECUTE 'DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON calendar_events';
  EXECUTE 'DROP POLICY IF EXISTS "Enable update for authenticated users only" ON calendar_events';
  EXECUTE 'DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON calendar_events';
  EXECUTE 'DROP POLICY IF EXISTS "calendar_select" ON calendar_events';
  EXECUTE 'DROP POLICY IF EXISTS "calendar_insert" ON calendar_events';
  EXECUTE 'DROP POLICY IF EXISTS "calendar_update" ON calendar_events';
  EXECUTE 'DROP POLICY IF EXISTS "calendar_delete" ON calendar_events';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated read" ON calendar_events';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated insert" ON calendar_events';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated update" ON calendar_events';
  EXECUTE 'DROP POLICY IF EXISTS "Allow authenticated delete" ON calendar_events';
END $$;

CREATE POLICY "events_select_project" ON calendar_events
  FOR SELECT USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "events_insert_project" ON calendar_events
  FOR INSERT WITH CHECK (is_project_member(project_id, auth.uid()) AND is_staff(auth.uid()));

CREATE POLICY "events_update_project" ON calendar_events
  FOR UPDATE USING (is_project_member(project_id, auth.uid()) AND is_staff(auth.uid()));

CREATE POLICY "events_delete_project" ON calendar_events
  FOR DELETE USING (is_project_member(project_id, auth.uid()) AND is_staff(auth.uid()));
