-- =============================================
-- 007: Store image dimensions for smart Miro sizing
-- =============================================

-- Reference image dimensions + Cloudinary URL on shots
ALTER TABLE shots ADD COLUMN IF NOT EXISTS ref_cloud_url text;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS ref_img_width int DEFAULT 0;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS ref_img_height int DEFAULT 0;

-- WIP image dimensions
ALTER TABLE miro_wip_images ADD COLUMN IF NOT EXISTS img_width int DEFAULT 0;
ALTER TABLE miro_wip_images ADD COLUMN IF NOT EXISTS img_height int DEFAULT 0;
