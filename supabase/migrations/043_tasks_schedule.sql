-- Tasks gain a planned schedule (start date + duration in days) so the Planning view
-- can render them on a Gantt grouped by department.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tasks ADD CONSTRAINT tasks_duration_positive CHECK (duration_days >= 1);

CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks (project_id, start_date);
