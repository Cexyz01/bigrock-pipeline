-- Multi-assignee tasks: junction table replacing the single tasks.assigned_to.
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees (user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees (task_id);

-- Backfill from legacy tasks.assigned_to
INSERT INTO task_assignees (task_id, user_id, assigned_at)
SELECT id, assigned_to, COALESCE(updated_at, created_at, NOW())
FROM tasks
WHERE assigned_to IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

-- RLS: any authenticated user can read; staff manages writes via service-role/edge-fn
-- (matches the existing tasks RLS pattern)
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS task_assignees_read ON task_assignees;
CREATE POLICY task_assignees_read ON task_assignees FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS task_assignees_write ON task_assignees;
CREATE POLICY task_assignees_write ON task_assignees FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
