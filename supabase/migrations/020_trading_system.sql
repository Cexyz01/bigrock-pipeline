-- ============================================
-- 020 — Trading System
-- Tables: pack_trade_tokens, pack_trades
-- New RLS on pack_user_cards for cross-user reads + self-delete
-- ============================================

-- ── 1. Trade Tokens ──
CREATE TABLE IF NOT EXISTS pack_trade_tokens (
  user_id            uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  tokens             int NOT NULL DEFAULT 3 CHECK (tokens >= 0 AND tokens <= 3),
  last_regenerated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pack_trade_tokens ENABLE ROW LEVEL SECURITY;

-- Users can read their own tokens
CREATE POLICY "trade_tokens_read_own" ON pack_trade_tokens FOR SELECT
  USING (user_id = auth.uid());

-- Users can insert their own token row (auto-init)
CREATE POLICY "trade_tokens_insert_own" ON pack_trade_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own tokens
CREATE POLICY "trade_tokens_update_own" ON pack_trade_tokens FOR UPDATE
  USING (user_id = auth.uid());

-- Staff can read all tokens
CREATE POLICY "trade_tokens_staff_read" ON pack_trade_tokens FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente'));

-- Staff can update all tokens
CREATE POLICY "trade_tokens_staff_update" ON pack_trade_tokens FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente'));

-- ── 2. Trades ──
CREATE TABLE IF NOT EXISTS pack_trades (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_card_number int NOT NULL CHECK (requested_card_number >= 0),
  offered_card_number   int CHECK (offered_card_number >= 0),
  rarity            text NOT NULL,
  status            text NOT NULL DEFAULT 'pending_counteroffer'
    CHECK (status IN ('pending_counteroffer','pending_approval','completed','rejected')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  CHECK (proposer_id != target_id)
);

CREATE INDEX IF NOT EXISTS idx_pack_trades_proposer ON pack_trades(proposer_id);
CREATE INDEX IF NOT EXISTS idx_pack_trades_target ON pack_trades(target_id);
CREATE INDEX IF NOT EXISTS idx_pack_trades_status ON pack_trades(status);

ALTER TABLE pack_trades ENABLE ROW LEVEL SECURITY;

-- Users can see trades where they are proposer or target
CREATE POLICY "trades_read_own" ON pack_trades FOR SELECT
  USING (proposer_id = auth.uid() OR target_id = auth.uid());

-- Users can insert trades where they are the proposer
CREATE POLICY "trades_insert_own" ON pack_trades FOR INSERT
  WITH CHECK (proposer_id = auth.uid());

-- Users can update trades where they are proposer or target
CREATE POLICY "trades_update_own" ON pack_trades FOR UPDATE
  USING (proposer_id = auth.uid() OR target_id = auth.uid());

-- Users can delete trades where they are proposer or target
CREATE POLICY "trades_delete_own" ON pack_trades FOR DELETE
  USING (proposer_id = auth.uid() OR target_id = auth.uid());

-- Staff can read all trades
CREATE POLICY "trades_staff_read" ON pack_trades FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente'));

-- Staff can update all trades
CREATE POLICY "trades_staff_update" ON pack_trades FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente'));

-- ── 3. New RLS on pack_user_cards ──

-- Allow ALL authenticated users to read ANY user's cards (needed to browse others' duplicates)
CREATE POLICY "pack_user_cards_read_all" ON pack_user_cards FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Allow users to delete their OWN cards (needed for trade swap)
CREATE POLICY "pack_user_cards_self_delete" ON pack_user_cards FOR DELETE
  USING (user_id = auth.uid());
