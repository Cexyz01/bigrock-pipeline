-- =============================================
-- 005: Add missing columns to Miro tables
-- =============================================

-- shot_code_item_id may be missing if migration 003 was run before this column was added
ALTER TABLE miro_shot_rows ADD COLUMN IF NOT EXISTS shot_code_item_id text;

-- image_url for persistent Cloudinary backup URLs
ALTER TABLE miro_wip_images ADD COLUMN IF NOT EXISTS image_url text;

-- Delete policy for miro_wip_images (needed for shot cleanup)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'miro_wip_images_delete') THEN
    CREATE POLICY "miro_wip_images_delete" ON miro_wip_images FOR DELETE USING (true);
  END IF;
END $$;

-- Delete policy for miro_shot_rows
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'miro_shot_rows_delete') THEN
    CREATE POLICY "miro_shot_rows_delete" ON miro_shot_rows FOR DELETE USING (true);
  END IF;
END $$;
