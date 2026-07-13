-- =============================================
-- 076: Timeline 2 — staff-only sandbox copy of shots (for testing)
-- =============================================
--
-- A SEPARATE table that mirrors the columns of `shots` (LIKE ... INCLUDING ALL).
-- Because it is its own table it shares NO foreign keys with the real pipeline:
-- editing rows here (durations, audio, output, timeline_enabled) can never
-- affect the live `shots` / the real Timeline. It is seeded and reset from the
-- client by copying the current project's live shots into it.
--
-- Scope: per-project (project_id copied from the live shots).
-- Access: staff only (docente / producer / admin ...), gated further in the UI.

CREATE TABLE IF NOT EXISTS timeline2_shots (LIKE shots INCLUDING ALL);

-- Bookkeeping columns unique to the sandbox.
ALTER TABLE timeline2_shots ADD COLUMN IF NOT EXISTS source_shot_id uuid;
ALTER TABLE timeline2_shots ADD COLUMN IF NOT EXISTS sandbox_copied_at timestamptz DEFAULT now();

-- ── RLS: staff members of the project may read/write the sandbox ──
ALTER TABLE timeline2_shots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "t2_shots_select" ON timeline2_shots;
DROP POLICY IF EXISTS "t2_shots_insert" ON timeline2_shots;
DROP POLICY IF EXISTS "t2_shots_update" ON timeline2_shots;
DROP POLICY IF EXISTS "t2_shots_delete" ON timeline2_shots;

CREATE POLICY "t2_shots_select" ON timeline2_shots
  FOR SELECT USING (is_project_member(project_id, auth.uid()) AND is_staff(auth.uid()));

CREATE POLICY "t2_shots_insert" ON timeline2_shots
  FOR INSERT WITH CHECK (is_project_member(project_id, auth.uid()) AND is_staff(auth.uid()));

CREATE POLICY "t2_shots_update" ON timeline2_shots
  FOR UPDATE USING (is_project_member(project_id, auth.uid()) AND is_staff(auth.uid()));

CREATE POLICY "t2_shots_delete" ON timeline2_shots
  FOR DELETE USING (is_project_member(project_id, auth.uid()) AND is_staff(auth.uid()));
