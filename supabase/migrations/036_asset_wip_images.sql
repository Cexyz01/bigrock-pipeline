-- ============================================
-- 036: Allow miro_wip_images to belong to an asset
-- ============================================
-- Asset tasks have no shot_id; we still want their committed WIP media to
-- show up on the storyboard. Make shot_id nullable and add asset_id.

ALTER TABLE miro_wip_images ALTER COLUMN shot_id DROP NOT NULL;
ALTER TABLE miro_wip_images ADD COLUMN IF NOT EXISTS asset_id uuid REFERENCES assets(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_miro_wip_asset_dept ON miro_wip_images(asset_id, department);
