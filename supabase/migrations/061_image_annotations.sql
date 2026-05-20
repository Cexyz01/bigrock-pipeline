-- Per-image teacher annotations (pen drawings on top of WIP / review images).
-- Stroke coordinates are normalised [0..1] of the image's natural size so the
-- same JSON can be replayed at any display scale.

CREATE TABLE IF NOT EXISTS image_annotations (
  image_url   TEXT PRIMARY KEY,
  strokes     JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE image_annotations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authed read image_annotations" ON image_annotations;
CREATE POLICY "Authed read image_annotations" ON image_annotations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Staff write image_annotations" ON image_annotations;
CREATE POLICY "Staff write image_annotations" ON image_annotations
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role <> 'studente'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role <> 'studente'));

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'image_annotations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE image_annotations;
  END IF;
END $$;
