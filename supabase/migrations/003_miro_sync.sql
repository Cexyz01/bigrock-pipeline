-- =============================================
-- 003: Miro Board Sync — Shot rows + WIP images
-- =============================================

-- Traccia la posizione di ogni shot sulla board Miro
CREATE TABLE IF NOT EXISTS miro_shot_rows (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  shot_id uuid REFERENCES shots(id) ON DELETE CASCADE NOT NULL UNIQUE,
  row_index int NOT NULL,
  frame_id text,
  shot_code_item_id text,
  created_at timestamptz DEFAULT now()
);

-- Traccia le immagini WIP caricate su Miro
CREATE TABLE IF NOT EXISTS miro_wip_images (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  shot_id uuid REFERENCES shots(id) ON DELETE CASCADE NOT NULL,
  task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  department text NOT NULL,
  miro_item_id text NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_miro_shot_rows_shot ON miro_shot_rows(shot_id);
CREATE INDEX IF NOT EXISTS idx_miro_wip_shot_dept ON miro_wip_images(shot_id, department);

ALTER TABLE miro_shot_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE miro_wip_images ENABLE ROW LEVEL SECURITY;

-- Tutti possono leggere (per controllare se la riga esiste)
CREATE POLICY "miro_shot_rows_select" ON miro_shot_rows FOR SELECT USING (true);
CREATE POLICY "miro_wip_images_select" ON miro_wip_images FOR SELECT USING (true);

-- Insert/update via service role (Edge Function) — policy permissiva, l'auth è nella function
CREATE POLICY "miro_shot_rows_insert" ON miro_shot_rows FOR INSERT WITH CHECK (true);
CREATE POLICY "miro_shot_rows_update" ON miro_shot_rows FOR UPDATE USING (true);
CREATE POLICY "miro_wip_images_insert" ON miro_wip_images FOR INSERT WITH CHECK (true);
