-- Tasks: how many people the task requires (capacity). The Planning view dims
-- tasks where the assigned count is below this number.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS required_assignees INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_required_assignees_positive;
ALTER TABLE tasks ADD CONSTRAINT tasks_required_assignees_positive CHECK (required_assignees >= 1);
