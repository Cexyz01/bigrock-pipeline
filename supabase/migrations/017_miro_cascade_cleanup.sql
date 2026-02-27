-- =============================================
-- 017: Miro WIP Images — CASCADE + Cleanup
-- =============================================
-- Cambia la FK task_id da ON DELETE SET NULL a ON DELETE CASCADE
-- Così quando un task viene cancellato, le sue righe miro_wip_images vengono eliminate automaticamente

-- 1. Rimuovi la FK esistente
ALTER TABLE miro_wip_images DROP CONSTRAINT IF EXISTS miro_wip_images_task_id_fkey;

-- 2. Ricrea con ON DELETE CASCADE
ALTER TABLE miro_wip_images
  ADD CONSTRAINT miro_wip_images_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;

-- 3. Pulisci eventuali righe orfane già esistenti (task_id NULL)
DELETE FROM miro_wip_images WHERE task_id IS NULL;

-- 4. Aggiungi indice su task_id per performance delle query
CREATE INDEX IF NOT EXISTS idx_miro_wip_task ON miro_wip_images(task_id);
