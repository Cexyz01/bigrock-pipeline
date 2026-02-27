-- ============================================
-- 019 — Allow multiple copies of the same card
-- Drop UNIQUE(user_id, card_number), add UNIQUE(user_id, card_number, copy_number)
-- ============================================

-- 1. Fix any NULL copy_numbers in existing data
UPDATE pack_user_cards SET copy_number = 0 WHERE copy_number IS NULL;

-- 2. Make copy_number NOT NULL with default 0
ALTER TABLE pack_user_cards
  ALTER COLUMN copy_number SET NOT NULL,
  ALTER COLUMN copy_number SET DEFAULT 0;

-- 3. Drop old constraint that blocks duplicate card_numbers per user
ALTER TABLE pack_user_cards
  DROP CONSTRAINT IF EXISTS pack_user_cards_user_id_card_number_key;

-- 4. Add new constraint: same user + same card + same copy_number is blocked
--    but same user + same card + DIFFERENT copy_number is allowed
ALTER TABLE pack_user_cards
  ADD CONSTRAINT pack_user_cards_user_card_copy_unique
  UNIQUE(user_id, card_number, copy_number);

-- 5. Index for efficient grouping by card_number per user
CREATE INDEX IF NOT EXISTS idx_pack_user_cards_user_card
  ON pack_user_cards(user_id, card_number);
