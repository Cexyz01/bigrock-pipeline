-- ============================================
-- 016: WIP Updates System
-- task_wip_updates, task_wip_views, new task columns
-- ============================================

-- 1. WIP Updates table — stores each update a student posts
CREATE TABLE IF NOT EXISTS task_wip_updates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  note text,
  images text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wip_updates_task ON task_wip_updates(task_id);
CREATE INDEX IF NOT EXISTS idx_wip_updates_created ON task_wip_updates(task_id, created_at DESC);

ALTER TABLE task_wip_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wip_updates_select" ON task_wip_updates FOR SELECT USING (true);
CREATE POLICY "wip_updates_insert" ON task_wip_updates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 2. WIP Views table — tracks when staff last viewed a task's WIP updates
CREATE TABLE IF NOT EXISTS task_wip_views (
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  viewed_at timestamptz DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

ALTER TABLE task_wip_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wip_views_select" ON task_wip_views FOR SELECT USING (true);
CREATE POLICY "wip_views_upsert" ON task_wip_views FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wip_views_update" ON task_wip_views FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Add last_wip_at to tasks (set when student posts WIP update)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_wip_at timestamptz;

-- 4. Add review metadata columns (for presentation)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS review_title text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS review_description text;

-- 5. Index for quick badge queries
CREATE INDEX IF NOT EXISTS idx_tasks_last_wip ON tasks(last_wip_at) WHERE last_wip_at IS NOT NULL;
