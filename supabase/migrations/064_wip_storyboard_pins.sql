-- ============================================
-- 064: Storyboard pins on WIP updates
-- Lets students/staff mark individual WIP images as "Show in Storyboard"
-- so that, beyond the latest WIP (current behavior), additional historical
-- images can be surfaced on the project storyboard.
-- ============================================

ALTER TABLE task_wip_updates
  ADD COLUMN IF NOT EXISTS pinned_storyboard_urls text[] NOT NULL DEFAULT '{}';

-- UPDATE policy: the WIP author can edit their own row; staff can edit any.
-- (016 only declared SELECT + INSERT, leaving UPDATE blocked under RLS.)
DROP POLICY IF EXISTS "wip_updates_update" ON task_wip_updates;
CREATE POLICY "wip_updates_update" ON task_wip_updates
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_wip_updates_pins
  ON task_wip_updates USING gin (pinned_storyboard_urls)
  WHERE array_length(pinned_storyboard_urls, 1) > 0;
