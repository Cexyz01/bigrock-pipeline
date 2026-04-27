-- Gantt planning items: independent of tasks/shots, free-form scheduling per project.
CREATE TABLE IF NOT EXISTS gantt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  lane TEXT NOT NULL DEFAULT 'General',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  color TEXT NOT NULL DEFAULT '#F28C28',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_gantt_project ON gantt_items (project_id);
CREATE INDEX IF NOT EXISTS idx_gantt_lane ON gantt_items (project_id, lane, sort_order);

ALTER TABLE gantt_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gantt_items_read ON gantt_items;
CREATE POLICY gantt_items_read ON gantt_items FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS gantt_items_write ON gantt_items;
CREATE POLICY gantt_items_write ON gantt_items FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
