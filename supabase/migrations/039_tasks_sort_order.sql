-- Add sort_order to tasks for drag-reorder within an asset/shot group.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sort_order INTEGER;

-- Backfill: assign ordinal per group key (asset_id | shot_id | 'none'), ordered by created_at ASC.
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(asset_id::text, shot_id::text, 'none')
           ORDER BY created_at ASC
         ) - 1 AS rn
  FROM tasks
)
UPDATE tasks t SET sort_order = n.rn FROM numbered n WHERE t.id = n.id AND t.sort_order IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_sort_order ON tasks (sort_order);
