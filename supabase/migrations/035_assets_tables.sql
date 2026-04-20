-- ============================================
-- 035: Assets table (modeling + texturing tasks)
-- ============================================
-- Adds a new Asset entity parallel to Shot.
-- Assets have ONLY two task departments: modeling and texturing.
-- Shots keep all OTHER departments (concept, rigging, animation, compositing, lighting, test_ai, sound).
-- Existing placeholder tasks with department modeling/texturing are removed.

-- ── Assets table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  sort_order int DEFAULT 0,
  status_modeling shot_status DEFAULT 'not_started',
  status_texturing shot_status DEFAULT 'not_started',
  ref_cloud_url text,
  ref_img_width int,
  ref_img_height int,
  output_cloud_url text,
  output_img_width int,
  output_img_height int,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assets_project ON assets(project_id);
CREATE INDEX IF NOT EXISTS idx_assets_sort ON assets(project_id, sort_order);

ALTER TABLE assets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "assets_select_project" ON assets';
  EXECUTE 'DROP POLICY IF EXISTS "assets_insert_project" ON assets';
  EXECUTE 'DROP POLICY IF EXISTS "assets_update_project" ON assets';
  EXECUTE 'DROP POLICY IF EXISTS "assets_delete_project" ON assets';
END $$;

CREATE POLICY "assets_select_project" ON assets
  FOR SELECT USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "assets_insert_project" ON assets
  FOR INSERT WITH CHECK (is_project_member(project_id, auth.uid()) AND is_staff(auth.uid()));

CREATE POLICY "assets_update_project" ON assets
  FOR UPDATE USING (is_project_member(project_id, auth.uid()));

CREATE POLICY "assets_delete_project" ON assets
  FOR DELETE USING (is_project_member(project_id, auth.uid()) AND is_staff(auth.uid()));

-- Enable realtime on assets
DO $$ BEGIN
  ALTER publication supabase_realtime ADD TABLE assets;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Add asset_id to tasks ────────────────────────────────────

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES assets(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_tasks_asset ON tasks(asset_id);

-- ── Delete placeholder modeling/texturing tasks ─────────────
-- These were attached to shots (old scheme); the user confirmed they are placeholders.
-- Real modeling/texturing work will be re-created on assets.

DELETE FROM tasks WHERE department IN ('modeling', 'texturing');
