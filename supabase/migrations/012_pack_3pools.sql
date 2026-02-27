-- ============================================
-- 012 — 3-Pool Pack System (Red, Green, Blue)
-- 120 cards, 3 pools x 40, timer, copy numbering
-- ============================================

-- 1. Clear all existing pack data (pre-launch)
TRUNCATE pack_user_cards CASCADE;
DELETE FROM pack_generated_packs;
DELETE FROM pack_cards;

-- ── pack_cards: expand to 120, add pack_type ──

ALTER TABLE pack_cards DROP CONSTRAINT IF EXISTS pack_cards_number_check;
ALTER TABLE pack_cards ADD CONSTRAINT pack_cards_number_check
  CHECK (number >= 0 AND number <= 119);

ALTER TABLE pack_cards
  ADD COLUMN IF NOT EXISTS pack_type text NOT NULL DEFAULT 'red';

DO $$ BEGIN
  ALTER TABLE pack_cards ADD CONSTRAINT pack_cards_pack_type_check
    CHECK (pack_type IN ('red', 'green', 'blue'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── pack_user_cards: expand range, add copy_number ──

ALTER TABLE pack_user_cards DROP CONSTRAINT IF EXISTS pack_user_cards_card_number_check;
ALTER TABLE pack_user_cards ADD CONSTRAINT pack_user_cards_card_number_check
  CHECK (card_number >= 0 AND card_number <= 119);

ALTER TABLE pack_user_cards
  ADD COLUMN IF NOT EXISTS copy_number int;

-- ── pack_generated_packs: add pack_type, cards → jsonb ──

ALTER TABLE pack_generated_packs
  ADD COLUMN IF NOT EXISTS pack_type text NOT NULL DEFAULT 'red';

DO $$ BEGIN
  ALTER TABLE pack_generated_packs ADD CONSTRAINT pack_gen_pack_type_check
    CHECK (pack_type IN ('red', 'green', 'blue'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Change cards from int[] to jsonb (table is empty, safe)
ALTER TABLE pack_generated_packs
  ALTER COLUMN cards TYPE jsonb USING to_jsonb(cards);

-- pack_number unique per pack_type (not globally)
ALTER TABLE pack_generated_packs DROP CONSTRAINT IF EXISTS pack_generated_packs_pack_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pack_gen_type_number
  ON pack_generated_packs(pack_type, pack_number);

CREATE INDEX IF NOT EXISTS idx_pack_gen_type
  ON pack_generated_packs(pack_type);

-- ── pack_generation_config: update defaults for 3-pool ──

UPDATE pack_generation_config SET
  total_packs = 9999,
  copies_per_rarity = '{"rainbow":1,"diamond":60,"gold":120,"rare":360}'::jsonb,
  generated = false,
  generated_at = NULL
WHERE id = 1;

-- ── pack_user_timers: new table for pack opening cooldown ──

CREATE TABLE IF NOT EXISTS pack_user_timers (
  user_id         uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  available_packs int NOT NULL DEFAULT 0 CHECK (available_packs >= 0 AND available_packs <= 3),
  last_pack_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pack_user_timers ENABLE ROW LEVEL SECURITY;

-- Users can manage their own timer
CREATE POLICY "timer_own" ON pack_user_timers FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Staff can manage all timers
CREATE POLICY "timer_staff" ON pack_user_timers FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente'));

-- ── Seed 120 cards ──
-- Red Pool  (000-039): 2 Rainbow + 4 Diamond + 6 Gold + 8 Rare + 20 Common
-- Green Pool(040-079): 2 Rainbow + 4 Diamond + 6 Gold + 8 Rare + 20 Common
-- Blue Pool (080-119): 2 Rainbow + 4 Diamond + 6 Gold + 8 Rare + 20 Common

INSERT INTO pack_cards (number, name, description, rarity, pack_type) VALUES
  -- ═══════════════ RED POOL (000-039) ═══════════════
  -- Rainbow (000-001)
  (0,   'Rainbow R-000', 'Carta arcobaleno leggendaria', 'rainbow', 'red'),
  (1,   'Rainbow R-001', 'Carta arcobaleno leggendaria', 'rainbow', 'red'),
  -- Diamond (002-005)
  (2,   'Diamond R-002', 'Carta diamante rara', 'diamond', 'red'),
  (3,   'Diamond R-003', 'Carta diamante rara', 'diamond', 'red'),
  (4,   'Diamond R-004', 'Carta diamante rara', 'diamond', 'red'),
  (5,   'Diamond R-005', 'Carta diamante rara', 'diamond', 'red'),
  -- Gold (006-011)
  (6,   'Gold R-006', 'Carta dorata speciale', 'gold', 'red'),
  (7,   'Gold R-007', 'Carta dorata speciale', 'gold', 'red'),
  (8,   'Gold R-008', 'Carta dorata speciale', 'gold', 'red'),
  (9,   'Gold R-009', 'Carta dorata speciale', 'gold', 'red'),
  (10,  'Gold R-010', 'Carta dorata speciale', 'gold', 'red'),
  (11,  'Gold R-011', 'Carta dorata speciale', 'gold', 'red'),
  -- Rare (012-019)
  (12,  'Rare R-012', 'Carta rara', 'rare', 'red'),
  (13,  'Rare R-013', 'Carta rara', 'rare', 'red'),
  (14,  'Rare R-014', 'Carta rara', 'rare', 'red'),
  (15,  'Rare R-015', 'Carta rara', 'rare', 'red'),
  (16,  'Rare R-016', 'Carta rara', 'rare', 'red'),
  (17,  'Rare R-017', 'Carta rara', 'rare', 'red'),
  (18,  'Rare R-018', 'Carta rara', 'rare', 'red'),
  (19,  'Rare R-019', 'Carta rara', 'rare', 'red'),
  -- Common (020-039)
  (20,  'Common R-020', 'Carta comune', 'common', 'red'),
  (21,  'Common R-021', 'Carta comune', 'common', 'red'),
  (22,  'Common R-022', 'Carta comune', 'common', 'red'),
  (23,  'Common R-023', 'Carta comune', 'common', 'red'),
  (24,  'Common R-024', 'Carta comune', 'common', 'red'),
  (25,  'Common R-025', 'Carta comune', 'common', 'red'),
  (26,  'Common R-026', 'Carta comune', 'common', 'red'),
  (27,  'Common R-027', 'Carta comune', 'common', 'red'),
  (28,  'Common R-028', 'Carta comune', 'common', 'red'),
  (29,  'Common R-029', 'Carta comune', 'common', 'red'),
  (30,  'Common R-030', 'Carta comune', 'common', 'red'),
  (31,  'Common R-031', 'Carta comune', 'common', 'red'),
  (32,  'Common R-032', 'Carta comune', 'common', 'red'),
  (33,  'Common R-033', 'Carta comune', 'common', 'red'),
  (34,  'Common R-034', 'Carta comune', 'common', 'red'),
  (35,  'Common R-035', 'Carta comune', 'common', 'red'),
  (36,  'Common R-036', 'Carta comune', 'common', 'red'),
  (37,  'Common R-037', 'Carta comune', 'common', 'red'),
  (38,  'Common R-038', 'Carta comune', 'common', 'red'),
  (39,  'Common R-039', 'Carta comune', 'common', 'red'),

  -- ═══════════════ GREEN POOL (040-079) ═══════════════
  -- Rainbow (040-041)
  (40,  'Rainbow G-040', 'Carta arcobaleno leggendaria', 'rainbow', 'green'),
  (41,  'Rainbow G-041', 'Carta arcobaleno leggendaria', 'rainbow', 'green'),
  -- Diamond (042-045)
  (42,  'Diamond G-042', 'Carta diamante rara', 'diamond', 'green'),
  (43,  'Diamond G-043', 'Carta diamante rara', 'diamond', 'green'),
  (44,  'Diamond G-044', 'Carta diamante rara', 'diamond', 'green'),
  (45,  'Diamond G-045', 'Carta diamante rara', 'diamond', 'green'),
  -- Gold (046-051)
  (46,  'Gold G-046', 'Carta dorata speciale', 'gold', 'green'),
  (47,  'Gold G-047', 'Carta dorata speciale', 'gold', 'green'),
  (48,  'Gold G-048', 'Carta dorata speciale', 'gold', 'green'),
  (49,  'Gold G-049', 'Carta dorata speciale', 'gold', 'green'),
  (50,  'Gold G-050', 'Carta dorata speciale', 'gold', 'green'),
  (51,  'Gold G-051', 'Carta dorata speciale', 'gold', 'green'),
  -- Rare (052-059)
  (52,  'Rare G-052', 'Carta rara', 'rare', 'green'),
  (53,  'Rare G-053', 'Carta rara', 'rare', 'green'),
  (54,  'Rare G-054', 'Carta rara', 'rare', 'green'),
  (55,  'Rare G-055', 'Carta rara', 'rare', 'green'),
  (56,  'Rare G-056', 'Carta rara', 'rare', 'green'),
  (57,  'Rare G-057', 'Carta rara', 'rare', 'green'),
  (58,  'Rare G-058', 'Carta rara', 'rare', 'green'),
  (59,  'Rare G-059', 'Carta rara', 'rare', 'green'),
  -- Common (060-079)
  (60,  'Common G-060', 'Carta comune', 'common', 'green'),
  (61,  'Common G-061', 'Carta comune', 'common', 'green'),
  (62,  'Common G-062', 'Carta comune', 'common', 'green'),
  (63,  'Common G-063', 'Carta comune', 'common', 'green'),
  (64,  'Common G-064', 'Carta comune', 'common', 'green'),
  (65,  'Common G-065', 'Carta comune', 'common', 'green'),
  (66,  'Common G-066', 'Carta comune', 'common', 'green'),
  (67,  'Common G-067', 'Carta comune', 'common', 'green'),
  (68,  'Common G-068', 'Carta comune', 'common', 'green'),
  (69,  'Common G-069', 'Carta comune', 'common', 'green'),
  (70,  'Common G-070', 'Carta comune', 'common', 'green'),
  (71,  'Common G-071', 'Carta comune', 'common', 'green'),
  (72,  'Common G-072', 'Carta comune', 'common', 'green'),
  (73,  'Common G-073', 'Carta comune', 'common', 'green'),
  (74,  'Common G-074', 'Carta comune', 'common', 'green'),
  (75,  'Common G-075', 'Carta comune', 'common', 'green'),
  (76,  'Common G-076', 'Carta comune', 'common', 'green'),
  (77,  'Common G-077', 'Carta comune', 'common', 'green'),
  (78,  'Common G-078', 'Carta comune', 'common', 'green'),
  (79,  'Common G-079', 'Carta comune', 'common', 'green'),

  -- ═══════════════ BLUE POOL (080-119) ═══════════════
  -- Rainbow (080-081)
  (80,  'Rainbow B-080', 'Carta arcobaleno leggendaria', 'rainbow', 'blue'),
  (81,  'Rainbow B-081', 'Carta arcobaleno leggendaria', 'rainbow', 'blue'),
  -- Diamond (082-085)
  (82,  'Diamond B-082', 'Carta diamante rara', 'diamond', 'blue'),
  (83,  'Diamond B-083', 'Carta diamante rara', 'diamond', 'blue'),
  (84,  'Diamond B-084', 'Carta diamante rara', 'diamond', 'blue'),
  (85,  'Diamond B-085', 'Carta diamante rara', 'diamond', 'blue'),
  -- Gold (086-091)
  (86,  'Gold B-086', 'Carta dorata speciale', 'gold', 'blue'),
  (87,  'Gold B-087', 'Carta dorata speciale', 'gold', 'blue'),
  (88,  'Gold B-088', 'Carta dorata speciale', 'gold', 'blue'),
  (89,  'Gold B-089', 'Carta dorata speciale', 'gold', 'blue'),
  (90,  'Gold B-090', 'Carta dorata speciale', 'gold', 'blue'),
  (91,  'Gold B-091', 'Carta dorata speciale', 'gold', 'blue'),
  -- Rare (092-099)
  (92,  'Rare B-092', 'Carta rara', 'rare', 'blue'),
  (93,  'Rare B-093', 'Carta rara', 'rare', 'blue'),
  (94,  'Rare B-094', 'Carta rara', 'rare', 'blue'),
  (95,  'Rare B-095', 'Carta rara', 'rare', 'blue'),
  (96,  'Rare B-096', 'Carta rara', 'rare', 'blue'),
  (97,  'Rare B-097', 'Carta rara', 'rare', 'blue'),
  (98,  'Rare B-098', 'Carta rara', 'rare', 'blue'),
  (99,  'Rare B-099', 'Carta rara', 'rare', 'blue'),
  -- Common (100-119)
  (100, 'Common B-100', 'Carta comune', 'common', 'blue'),
  (101, 'Common B-101', 'Carta comune', 'common', 'blue'),
  (102, 'Common B-102', 'Carta comune', 'common', 'blue'),
  (103, 'Common B-103', 'Carta comune', 'common', 'blue'),
  (104, 'Common B-104', 'Carta comune', 'common', 'blue'),
  (105, 'Common B-105', 'Carta comune', 'common', 'blue'),
  (106, 'Common B-106', 'Carta comune', 'common', 'blue'),
  (107, 'Common B-107', 'Carta comune', 'common', 'blue'),
  (108, 'Common B-108', 'Carta comune', 'common', 'blue'),
  (109, 'Common B-109', 'Carta comune', 'common', 'blue'),
  (110, 'Common B-110', 'Carta comune', 'common', 'blue'),
  (111, 'Common B-111', 'Carta comune', 'common', 'blue'),
  (112, 'Common B-112', 'Carta comune', 'common', 'blue'),
  (113, 'Common B-113', 'Carta comune', 'common', 'blue'),
  (114, 'Common B-114', 'Carta comune', 'common', 'blue'),
  (115, 'Common B-115', 'Carta comune', 'common', 'blue'),
  (116, 'Common B-116', 'Carta comune', 'common', 'blue'),
  (117, 'Common B-117', 'Carta comune', 'common', 'blue'),
  (118, 'Common B-118', 'Carta comune', 'common', 'blue'),
  (119, 'Common B-119', 'Carta comune', 'common', 'blue');
