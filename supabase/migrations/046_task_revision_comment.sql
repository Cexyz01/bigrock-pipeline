-- Revision comment pinned on a task when staff sends it back to WIP.
-- Cleared on approve or when the student re-submits for review (App.jsx
-- handleUpdateTask already nulls this on status transitions).
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS revision_comment text,
  ADD COLUMN IF NOT EXISTS revision_comment_at timestamptz;
