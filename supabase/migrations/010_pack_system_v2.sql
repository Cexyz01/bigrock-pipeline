-- ============================================
-- 010 — Pack System V2 (Greed Island)
-- New rarity tiers + pack generation system
-- ============================================

-- 1. Clear old card data (no users have cards yet)
TRUNCATE pack_user_cards;
DELETE FROM pack_cards;

-- 2. Update rarity constraint to new tiers
ALTER TABLE pack_cards DROP CONSTRAINT IF EXISTS pack_cards_rarity_check;
ALTER TABLE pack_cards ADD CONSTRAINT pack_cards_rarity_check
  CHECK (rarity IN ('common','rare','gold','diamond','rainbow'));

-- 3. Seed 100 cards with proper rarity tiers
-- 000-004: Rainbow (5 cards)
-- 005-014: Diamond (10 cards)
-- 015-029: Gold (15 cards)
-- 030-049: Rare (20 cards)
-- 050-099: Common (50 cards)
INSERT INTO pack_cards (number, name, description, rarity) VALUES
  -- Rainbow (5)
  (0,  'Rainbow #000', 'Carta arcobaleno leggendaria', 'rainbow'),
  (1,  'Rainbow #001', 'Carta arcobaleno leggendaria', 'rainbow'),
  (2,  'Rainbow #002', 'Carta arcobaleno leggendaria', 'rainbow'),
  (3,  'Rainbow #003', 'Carta arcobaleno leggendaria', 'rainbow'),
  (4,  'Rainbow #004', 'Carta arcobaleno leggendaria', 'rainbow'),
  -- Diamond (10)
  (5,  'Diamond #005', 'Carta diamante rara', 'diamond'),
  (6,  'Diamond #006', 'Carta diamante rara', 'diamond'),
  (7,  'Diamond #007', 'Carta diamante rara', 'diamond'),
  (8,  'Diamond #008', 'Carta diamante rara', 'diamond'),
  (9,  'Diamond #009', 'Carta diamante rara', 'diamond'),
  (10, 'Diamond #010', 'Carta diamante rara', 'diamond'),
  (11, 'Diamond #011', 'Carta diamante rara', 'diamond'),
  (12, 'Diamond #012', 'Carta diamante rara', 'diamond'),
  (13, 'Diamond #013', 'Carta diamante rara', 'diamond'),
  (14, 'Diamond #014', 'Carta diamante rara', 'diamond'),
  -- Gold (15)
  (15, 'Gold #015', 'Carta dorata speciale', 'gold'),
  (16, 'Gold #016', 'Carta dorata speciale', 'gold'),
  (17, 'Gold #017', 'Carta dorata speciale', 'gold'),
  (18, 'Gold #018', 'Carta dorata speciale', 'gold'),
  (19, 'Gold #019', 'Carta dorata speciale', 'gold'),
  (20, 'Gold #020', 'Carta dorata speciale', 'gold'),
  (21, 'Gold #021', 'Carta dorata speciale', 'gold'),
  (22, 'Gold #022', 'Carta dorata speciale', 'gold'),
  (23, 'Gold #023', 'Carta dorata speciale', 'gold'),
  (24, 'Gold #024', 'Carta dorata speciale', 'gold'),
  (25, 'Gold #025', 'Carta dorata speciale', 'gold'),
  (26, 'Gold #026', 'Carta dorata speciale', 'gold'),
  (27, 'Gold #027', 'Carta dorata speciale', 'gold'),
  (28, 'Gold #028', 'Carta dorata speciale', 'gold'),
  (29, 'Gold #029', 'Carta dorata speciale', 'gold'),
  -- Rare (20)
  (30, 'Rare #030', 'Carta rara', 'rare'),
  (31, 'Rare #031', 'Carta rara', 'rare'),
  (32, 'Rare #032', 'Carta rara', 'rare'),
  (33, 'Rare #033', 'Carta rara', 'rare'),
  (34, 'Rare #034', 'Carta rara', 'rare'),
  (35, 'Rare #035', 'Carta rara', 'rare'),
  (36, 'Rare #036', 'Carta rara', 'rare'),
  (37, 'Rare #037', 'Carta rara', 'rare'),
  (38, 'Rare #038', 'Carta rara', 'rare'),
  (39, 'Rare #039', 'Carta rara', 'rare'),
  (40, 'Rare #040', 'Carta rara', 'rare'),
  (41, 'Rare #041', 'Carta rara', 'rare'),
  (42, 'Rare #042', 'Carta rara', 'rare'),
  (43, 'Rare #043', 'Carta rara', 'rare'),
  (44, 'Rare #044', 'Carta rara', 'rare'),
  (45, 'Rare #045', 'Carta rara', 'rare'),
  (46, 'Rare #046', 'Carta rara', 'rare'),
  (47, 'Rare #047', 'Carta rara', 'rare'),
  (48, 'Rare #048', 'Carta rara', 'rare'),
  (49, 'Rare #049', 'Carta rara', 'rare'),
  -- Common (50)
  (50, 'Common #050', 'Carta comune', 'common'),
  (51, 'Common #051', 'Carta comune', 'common'),
  (52, 'Common #052', 'Carta comune', 'common'),
  (53, 'Common #053', 'Carta comune', 'common'),
  (54, 'Common #054', 'Carta comune', 'common'),
  (55, 'Common #055', 'Carta comune', 'common'),
  (56, 'Common #056', 'Carta comune', 'common'),
  (57, 'Common #057', 'Carta comune', 'common'),
  (58, 'Common #058', 'Carta comune', 'common'),
  (59, 'Common #059', 'Carta comune', 'common'),
  (60, 'Common #060', 'Carta comune', 'common'),
  (61, 'Common #061', 'Carta comune', 'common'),
  (62, 'Common #062', 'Carta comune', 'common'),
  (63, 'Common #063', 'Carta comune', 'common'),
  (64, 'Common #064', 'Carta comune', 'common'),
  (65, 'Common #065', 'Carta comune', 'common'),
  (66, 'Common #066', 'Carta comune', 'common'),
  (67, 'Common #067', 'Carta comune', 'common'),
  (68, 'Common #068', 'Carta comune', 'common'),
  (69, 'Common #069', 'Carta comune', 'common'),
  (70, 'Common #070', 'Carta comune', 'common'),
  (71, 'Common #071', 'Carta comune', 'common'),
  (72, 'Common #072', 'Carta comune', 'common'),
  (73, 'Common #073', 'Carta comune', 'common'),
  (74, 'Common #074', 'Carta comune', 'common'),
  (75, 'Common #075', 'Carta comune', 'common'),
  (76, 'Common #076', 'Carta comune', 'common'),
  (77, 'Common #077', 'Carta comune', 'common'),
  (78, 'Common #078', 'Carta comune', 'common'),
  (79, 'Common #079', 'Carta comune', 'common'),
  (80, 'Common #080', 'Carta comune', 'common'),
  (81, 'Common #081', 'Carta comune', 'common'),
  (82, 'Common #082', 'Carta comune', 'common'),
  (83, 'Common #083', 'Carta comune', 'common'),
  (84, 'Common #084', 'Carta comune', 'common'),
  (85, 'Common #085', 'Carta comune', 'common'),
  (86, 'Common #086', 'Carta comune', 'common'),
  (87, 'Common #087', 'Carta comune', 'common'),
  (88, 'Common #088', 'Carta comune', 'common'),
  (89, 'Common #089', 'Carta comune', 'common'),
  (90, 'Common #090', 'Carta comune', 'common'),
  (91, 'Common #091', 'Carta comune', 'common'),
  (92, 'Common #092', 'Carta comune', 'common'),
  (93, 'Common #093', 'Carta comune', 'common'),
  (94, 'Common #094', 'Carta comune', 'common'),
  (95, 'Common #095', 'Carta comune', 'common'),
  (96, 'Common #096', 'Carta comune', 'common'),
  (97, 'Common #097', 'Carta comune', 'common'),
  (98, 'Common #098', 'Carta comune', 'common'),
  (99, 'Common #099', 'Carta comune', 'common');

-- 4. Pack generation config (singleton table)
CREATE TABLE IF NOT EXISTS pack_generation_config (
  id          int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_packs int NOT NULL DEFAULT 10000,
  cards_per_pack int NOT NULL DEFAULT 4,
  copies_per_rarity jsonb NOT NULL DEFAULT '{"rainbow":1,"diamond":60,"gold":120,"rare":360}',
  slot_weights jsonb NOT NULL DEFAULT '[{"rainbow":0,"diamond":0,"gold":0,"rare":0},{"rainbow":0,"diamond":0,"gold":0,"rare":10},{"rainbow":0,"diamond":5,"gold":15,"rare":30},{"rainbow":100,"diamond":95,"gold":85,"rare":60}]',
  generated   boolean NOT NULL DEFAULT false,
  generated_at timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO pack_generation_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 5. Generated packs table
CREATE TABLE IF NOT EXISTS pack_generated_packs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_number int NOT NULL UNIQUE CHECK (pack_number >= 1),
  cards       int[] NOT NULL,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  opened      boolean NOT NULL DEFAULT false,
  opened_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pack_gen_assigned ON pack_generated_packs(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pack_gen_opened ON pack_generated_packs(opened);

-- 6. RLS — pack_generation_config (staff only)
ALTER TABLE pack_generation_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pack_config_staff_read" ON pack_generation_config FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente'));
CREATE POLICY "pack_config_staff_update" ON pack_generation_config FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente'));
CREATE POLICY "pack_config_staff_insert" ON pack_generation_config FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente'));

-- 7. RLS — pack_generated_packs
ALTER TABLE pack_generated_packs ENABLE ROW LEVEL SECURITY;

-- Staff can do everything
CREATE POLICY "pack_packs_staff_select" ON pack_generated_packs FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente'));
CREATE POLICY "pack_packs_staff_insert" ON pack_generated_packs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente'));
CREATE POLICY "pack_packs_staff_update" ON pack_generated_packs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente'));
CREATE POLICY "pack_packs_staff_delete" ON pack_generated_packs FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente'));

-- Users can see own assigned packs
CREATE POLICY "pack_packs_user_read" ON pack_generated_packs FOR SELECT
  USING (assigned_to = auth.uid());

-- Users can mark own packs as opened
CREATE POLICY "pack_packs_user_open" ON pack_generated_packs FOR UPDATE
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- 8. Allow users to insert their own cards (for pack opening)
CREATE POLICY "pack_user_cards_self_insert" ON pack_user_cards FOR INSERT
  WITH CHECK (user_id = auth.uid());
