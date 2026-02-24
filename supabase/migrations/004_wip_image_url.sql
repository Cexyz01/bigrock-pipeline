-- =============================================
-- 004: Add image_url to miro_wip_images
-- Stores Cloudinary URL for each WIP image
-- so we can display them in a review page
-- without depending on Miro API
-- =============================================

ALTER TABLE miro_wip_images
ADD COLUMN IF NOT EXISTS image_url text;
