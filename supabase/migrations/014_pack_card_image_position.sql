-- ============================================
-- 014 — Add image_position column to pack_cards
-- ============================================
-- Stores { x: number, y: number, scale: number } for image positioning within card frame
-- x/y = percentage offset (0-100), scale = background-size percentage (100-300)

ALTER TABLE pack_cards ADD COLUMN IF NOT EXISTS image_position jsonb DEFAULT NULL;
