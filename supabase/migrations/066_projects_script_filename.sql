-- ============================================
-- 066: Project Script Filename
-- ============================================
-- Stores the original .docx filename uploaded by the producer so the
-- Sceneggiatura tab can show "Sceneggiatura_v3.docx · aggiornata il…".
-- The extracted text itself lives in projects.script (added in 065).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS script_filename text;
