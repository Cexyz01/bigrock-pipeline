-- ============================================
-- 067: Selectable WIPs for review
-- Staff tick which WIP updates to send to review; only those show up in the
-- review carousel. Defaults to false (nothing pre-selected) so the
-- "Submit for Review" button stays disabled until staff picks at least one.
-- ============================================

ALTER TABLE task_wip_updates
  ADD COLUMN IF NOT EXISTS selected_for_review boolean NOT NULL DEFAULT false;

-- Backfill: existing tasks already in 'review' status need every WIP marked
-- selected so the review page doesn't go blank for in-flight reviews.
UPDATE task_wip_updates u
   SET selected_for_review = true
  FROM tasks t
 WHERE u.task_id = t.id
   AND t.status = 'review'
   AND u.selected_for_review = false;

CREATE INDEX IF NOT EXISTS idx_wip_updates_selected
  ON task_wip_updates (task_id)
  WHERE selected_for_review = true;
