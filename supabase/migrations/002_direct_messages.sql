-- =============================================
-- 002: Direct Messages (DM) — Staff ↔ Studente
-- =============================================

CREATE TABLE IF NOT EXISTS direct_messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  sender_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  recipient_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  body text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_participants ON direct_messages (sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_dm_recipient ON direct_messages (recipient_id, read);

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Solo mittente o destinatario possono leggere
CREATE POLICY "dm_select" ON direct_messages FOR SELECT USING (
  auth.uid() = sender_id OR auth.uid() = recipient_id
);

-- Chiunque autenticato può inviare, ma almeno uno dei due deve essere staff
CREATE POLICY "dm_insert" ON direct_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND (
    is_staff(auth.uid())
    OR is_staff(recipient_id)
  )
);

-- Solo il destinatario può segnare come letto
CREATE POLICY "dm_update" ON direct_messages FOR UPDATE USING (
  auth.uid() = recipient_id
) WITH CHECK (
  auth.uid() = recipient_id
);
