-- Project pauses: date ranges where work is paused (e.g. holidays, breaks).
-- The Planning view compresses these days visually so they don't waste horizontal space.
CREATE TABLE IF NOT EXISTS project_pauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_project_pauses_project ON project_pauses (project_id, start_date);

ALTER TABLE project_pauses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_pauses_read ON project_pauses;
CREATE POLICY project_pauses_read ON project_pauses FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS project_pauses_write ON project_pauses;
CREATE POLICY project_pauses_write ON project_pauses FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
