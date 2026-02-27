-- ============================================
-- 018: Per-WIP Comment System
-- wip_comments — staff can comment on individual WIP updates
-- ============================================

CREATE TABLE IF NOT EXISTS wip_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wip_update_id uuid REFERENCES task_wip_updates(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wip_comments_wip ON wip_comments(wip_update_id);
CREATE INDEX IF NOT EXISTS idx_wip_comments_created ON wip_comments(wip_update_id, created_at);

ALTER TABLE wip_comments ENABLE ROW LEVEL SECURITY;

-- Everyone can read WIP comments
CREATE POLICY "wip_comments_select" ON wip_comments FOR SELECT USING (true);

-- Only staff can insert WIP comments
CREATE POLICY "wip_comments_insert" ON wip_comments FOR INSERT
  WITH CHECK (is_staff(auth.uid()));
