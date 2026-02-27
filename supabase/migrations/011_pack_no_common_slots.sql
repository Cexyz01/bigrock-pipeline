-- ============================================
-- 011 — Add no_common_slots to pack config
-- ============================================

ALTER TABLE pack_generation_config
  ADD COLUMN IF NOT EXISTS no_common_slots jsonb NOT NULL DEFAULT '[false, false, false, false]';
