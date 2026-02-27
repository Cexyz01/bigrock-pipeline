-- ============================================
-- 009 — Pack Cards (Greed Island Collection)
-- ============================================

-- Card definitions (100 cards, 000-099)
CREATE TABLE IF NOT EXISTS pack_cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number      int  NOT NULL UNIQUE CHECK (number >= 0 AND number <= 99),
  name        text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  image_url   text,                          -- Cloudinary URL
  rarity      text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- User card ownership
CREATE TABLE IF NOT EXISTS pack_user_cards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  card_number int  NOT NULL CHECK (card_number >= 0 AND card_number <= 99),
  obtained_at timestamptz NOT NULL DEFAULT now(),
  obtained_via text NOT NULL DEFAULT 'reward',
  UNIQUE(user_id, card_number)
);

CREATE INDEX IF NOT EXISTS idx_pack_user_cards_user ON pack_user_cards(user_id);

-- RLS
ALTER TABLE pack_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE pack_user_cards ENABLE ROW LEVEL SECURITY;

-- Everyone can read card definitions
CREATE POLICY "pack_cards_read" ON pack_cards FOR SELECT USING (true);

-- Staff can manage card definitions
CREATE POLICY "pack_cards_staff_insert" ON pack_cards FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente')
  );
CREATE POLICY "pack_cards_staff_update" ON pack_cards FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente')
  );
CREATE POLICY "pack_cards_staff_delete" ON pack_cards FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente')
  );

-- Users can read their own cards
CREATE POLICY "pack_user_cards_read_own" ON pack_user_cards FOR SELECT
  USING (user_id = auth.uid());

-- Staff can read all user cards
CREATE POLICY "pack_user_cards_staff_read" ON pack_user_cards FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente')
  );

-- Staff can grant cards to users
CREATE POLICY "pack_user_cards_staff_insert" ON pack_user_cards FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente')
  );

-- Staff can revoke cards
CREATE POLICY "pack_user_cards_staff_delete" ON pack_user_cards FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role != 'studente')
  );

-- Seed all 100 card slots with placeholder names
INSERT INTO pack_cards (number, name, description, rarity) VALUES
  (0,  'Carta #000', 'Carta misteriosa da scoprire', 'legendary'),
  (1,  'Carta #001', 'Carta misteriosa da scoprire', 'common'),
  (2,  'Carta #002', 'Carta misteriosa da scoprire', 'common'),
  (3,  'Carta #003', 'Carta misteriosa da scoprire', 'common'),
  (4,  'Carta #004', 'Carta misteriosa da scoprire', 'common'),
  (5,  'Carta #005', 'Carta misteriosa da scoprire', 'rare'),
  (6,  'Carta #006', 'Carta misteriosa da scoprire', 'common'),
  (7,  'Carta #007', 'Carta misteriosa da scoprire', 'common'),
  (8,  'Carta #008', 'Carta misteriosa da scoprire', 'common'),
  (9,  'Carta #009', 'Carta misteriosa da scoprire', 'common'),
  (10, 'Carta #010', 'Carta misteriosa da scoprire', 'rare'),
  (11, 'Carta #011', 'Carta misteriosa da scoprire', 'common'),
  (12, 'Carta #012', 'Carta misteriosa da scoprire', 'common'),
  (13, 'Carta #013', 'Carta misteriosa da scoprire', 'common'),
  (14, 'Carta #014', 'Carta misteriosa da scoprire', 'common'),
  (15, 'Carta #015', 'Carta misteriosa da scoprire', 'epic'),
  (16, 'Carta #016', 'Carta misteriosa da scoprire', 'common'),
  (17, 'Carta #017', 'Carta misteriosa da scoprire', 'common'),
  (18, 'Carta #018', 'Carta misteriosa da scoprire', 'common'),
  (19, 'Carta #019', 'Carta misteriosa da scoprire', 'common'),
  (20, 'Carta #020', 'Carta misteriosa da scoprire', 'rare'),
  (21, 'Carta #021', 'Carta misteriosa da scoprire', 'common'),
  (22, 'Carta #022', 'Carta misteriosa da scoprire', 'common'),
  (23, 'Carta #023', 'Carta misteriosa da scoprire', 'common'),
  (24, 'Carta #024', 'Carta misteriosa da scoprire', 'common'),
  (25, 'Carta #025', 'Carta misteriosa da scoprire', 'epic'),
  (26, 'Carta #026', 'Carta misteriosa da scoprire', 'common'),
  (27, 'Carta #027', 'Carta misteriosa da scoprire', 'common'),
  (28, 'Carta #028', 'Carta misteriosa da scoprire', 'common'),
  (29, 'Carta #029', 'Carta misteriosa da scoprire', 'common'),
  (30, 'Carta #030', 'Carta misteriosa da scoprire', 'rare'),
  (31, 'Carta #031', 'Carta misteriosa da scoprire', 'common'),
  (32, 'Carta #032', 'Carta misteriosa da scoprire', 'common'),
  (33, 'Carta #033', 'Carta misteriosa da scoprire', 'common'),
  (34, 'Carta #034', 'Carta misteriosa da scoprire', 'common'),
  (35, 'Carta #035', 'Carta misteriosa da scoprire', 'common'),
  (36, 'Carta #036', 'Carta misteriosa da scoprire', 'common'),
  (37, 'Carta #037', 'Carta misteriosa da scoprire', 'common'),
  (38, 'Carta #038', 'Carta misteriosa da scoprire', 'common'),
  (39, 'Carta #039', 'Carta misteriosa da scoprire', 'common'),
  (40, 'Carta #040', 'Carta misteriosa da scoprire', 'rare'),
  (41, 'Carta #041', 'Carta misteriosa da scoprire', 'common'),
  (42, 'Carta #042', 'Carta misteriosa da scoprire', 'common'),
  (43, 'Carta #043', 'Carta misteriosa da scoprire', 'common'),
  (44, 'Carta #044', 'Carta misteriosa da scoprire', 'common'),
  (45, 'Carta #045', 'Carta misteriosa da scoprire', 'common'),
  (46, 'Carta #046', 'Carta misteriosa da scoprire', 'common'),
  (47, 'Carta #047', 'Carta misteriosa da scoprire', 'common'),
  (48, 'Carta #048', 'Carta misteriosa da scoprire', 'common'),
  (49, 'Carta #049', 'Carta misteriosa da scoprire', 'common'),
  (50, 'Carta #050', 'Carta misteriosa da scoprire', 'legendary'),
  (51, 'Carta #051', 'Carta misteriosa da scoprire', 'common'),
  (52, 'Carta #052', 'Carta misteriosa da scoprire', 'common'),
  (53, 'Carta #053', 'Carta misteriosa da scoprire', 'common'),
  (54, 'Carta #054', 'Carta misteriosa da scoprire', 'common'),
  (55, 'Carta #055', 'Carta misteriosa da scoprire', 'epic'),
  (56, 'Carta #056', 'Carta misteriosa da scoprire', 'common'),
  (57, 'Carta #057', 'Carta misteriosa da scoprire', 'common'),
  (58, 'Carta #058', 'Carta misteriosa da scoprire', 'common'),
  (59, 'Carta #059', 'Carta misteriosa da scoprire', 'common'),
  (60, 'Carta #060', 'Carta misteriosa da scoprire', 'rare'),
  (61, 'Carta #061', 'Carta misteriosa da scoprire', 'common'),
  (62, 'Carta #062', 'Carta misteriosa da scoprire', 'common'),
  (63, 'Carta #063', 'Carta misteriosa da scoprire', 'common'),
  (64, 'Carta #064', 'Carta misteriosa da scoprire', 'common'),
  (65, 'Carta #065', 'Carta misteriosa da scoprire', 'common'),
  (66, 'Carta #066', 'Carta misteriosa da scoprire', 'common'),
  (67, 'Carta #067', 'Carta misteriosa da scoprire', 'common'),
  (68, 'Carta #068', 'Carta misteriosa da scoprire', 'common'),
  (69, 'Carta #069', 'Carta misteriosa da scoprire', 'common'),
  (70, 'Carta #070', 'Carta misteriosa da scoprire', 'rare'),
  (71, 'Carta #071', 'Carta misteriosa da scoprire', 'common'),
  (72, 'Carta #072', 'Carta misteriosa da scoprire', 'common'),
  (73, 'Carta #073', 'Carta misteriosa da scoprire', 'common'),
  (74, 'Carta #074', 'Carta misteriosa da scoprire', 'common'),
  (75, 'Carta #075', 'Carta misteriosa da scoprire', 'epic'),
  (76, 'Carta #076', 'Carta misteriosa da scoprire', 'common'),
  (77, 'Carta #077', 'Carta misteriosa da scoprire', 'common'),
  (78, 'Carta #078', 'Carta misteriosa da scoprire', 'common'),
  (79, 'Carta #079', 'Carta misteriosa da scoprire', 'common'),
  (80, 'Carta #080', 'Carta misteriosa da scoprire', 'rare'),
  (81, 'Carta #081', 'Carta misteriosa da scoprire', 'common'),
  (82, 'Carta #082', 'Carta misteriosa da scoprire', 'common'),
  (83, 'Carta #083', 'Carta misteriosa da scoprire', 'common'),
  (84, 'Carta #084', 'Carta misteriosa da scoprire', 'common'),
  (85, 'Carta #085', 'Carta misteriosa da scoprire', 'common'),
  (86, 'Carta #086', 'Carta misteriosa da scoprire', 'common'),
  (87, 'Carta #087', 'Carta misteriosa da scoprire', 'common'),
  (88, 'Carta #088', 'Carta misteriosa da scoprire', 'common'),
  (89, 'Carta #089', 'Carta misteriosa da scoprire', 'common'),
  (90, 'Carta #090', 'Carta misteriosa da scoprire', 'rare'),
  (91, 'Carta #091', 'Carta misteriosa da scoprire', 'common'),
  (92, 'Carta #092', 'Carta misteriosa da scoprire', 'common'),
  (93, 'Carta #093', 'Carta misteriosa da scoprire', 'common'),
  (94, 'Carta #094', 'Carta misteriosa da scoprire', 'common'),
  (95, 'Carta #095', 'Carta misteriosa da scoprire', 'epic'),
  (96, 'Carta #096', 'Carta misteriosa da scoprire', 'common'),
  (97, 'Carta #097', 'Carta misteriosa da scoprire', 'common'),
  (98, 'Carta #098', 'Carta misteriosa da scoprire', 'common'),
  (99, 'Carta #099', 'Carta misteriosa da scoprire', 'legendary')
ON CONFLICT (number) DO NOTHING;
