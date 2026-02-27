-- ============================================
-- 021 — Real-Time Trading System
-- Replaces async propose/counter flow with live session
-- ============================================

-- 1. Clear old async trade data
DELETE FROM pack_trades;

-- 2. Drop old async columns
ALTER TABLE pack_trades DROP COLUMN IF EXISTS requested_card_number;
ALTER TABLE pack_trades DROP COLUMN IF EXISTS offered_card_number;
ALTER TABLE pack_trades DROP COLUMN IF EXISTS rarity;

-- 3. Add real-time session columns
ALTER TABLE pack_trades ADD COLUMN proposer_card_number int;
ALTER TABLE pack_trades ADD COLUMN target_card_number int;
ALTER TABLE pack_trades ADD COLUMN proposer_accepted boolean NOT NULL DEFAULT false;
ALTER TABLE pack_trades ADD COLUMN target_accepted boolean NOT NULL DEFAULT false;

-- 4. Replace status constraint with new lifecycle
ALTER TABLE pack_trades DROP CONSTRAINT IF EXISTS pack_trades_status_check;
ALTER TABLE pack_trades ADD CONSTRAINT pack_trades_status_check
  CHECK (status IN ('pending_invite','active','completed','cancelled','rejected'));
ALTER TABLE pack_trades ALTER COLUMN status SET DEFAULT 'pending_invite';

-- 5. Set REPLICA IDENTITY FULL for Supabase Realtime filtered subscriptions
--    Required so UPDATE events include all columns (not just PK) for filtering
ALTER TABLE pack_trades REPLICA IDENTITY FULL;
