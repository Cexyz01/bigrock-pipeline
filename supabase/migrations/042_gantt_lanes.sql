-- Promote gantt lanes to first-class entities so they can exist without items.
CREATE TABLE IF NOT EXISTS gantt_lanes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_gantt_lanes_project ON gantt_lanes (project_id, sort_order);

-- Backfill from any lanes already referenced by items
INSERT INTO gantt_lanes (project_id, name, sort_order)
SELECT DISTINCT project_id, lane, 0
FROM gantt_items
WHERE lane IS NOT NULL AND lane <> ''
ON CONFLICT (project_id, name) DO NOTHING;

ALTER TABLE gantt_lanes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gantt_lanes_read ON gantt_lanes;
CREATE POLICY gantt_lanes_read ON gantt_lanes FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS gantt_lanes_write ON gantt_lanes;
CREATE POLICY gantt_lanes_write ON gantt_lanes FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
