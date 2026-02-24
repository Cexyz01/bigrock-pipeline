-- =============================================
-- 006: Multi WIP images per task + task index
-- =============================================

-- image_order to track order of images within a task (0, 1, 2, 3)
ALTER TABLE miro_wip_images ADD COLUMN IF NOT EXISTS image_order int DEFAULT 0;

-- Index for fast lookup by task
CREATE INDEX IF NOT EXISTS idx_miro_wip_task ON miro_wip_images(task_id);
