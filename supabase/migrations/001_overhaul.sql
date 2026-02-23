-- ============================================
-- BigRock Pipeline — Overhaul Migration
-- ============================================

-- 1. Mood emoji on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS mood_emoji text DEFAULT NULL;

-- 2. Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  channel text NOT NULL,
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat policies: everyone can read general, staff reads all, students read own department
CREATE POLICY "chat_select" ON chat_messages FOR SELECT USING (
  channel = 'general'
  OR is_staff(auth.uid())
  OR channel = (SELECT department::text FROM profiles WHERE id = auth.uid())
);

CREATE POLICY "chat_insert" ON chat_messages FOR INSERT WITH CHECK (
  auth.uid() = author_id
  AND (
    channel = 'general'
    OR is_staff(auth.uid())
    OR channel = (SELECT department::text FROM profiles WHERE id = auth.uid())
  )
);

-- 3. Storage bucket "avatars"
-- NOTE: Create this manually from the Supabase Dashboard:
--   1. Go to Storage → New Bucket
--   2. Name: "avatars"
--   3. Public bucket: YES
--   4. File size limit: 1MB
--   5. Allowed MIME types: image/png, image/jpeg, image/webp, image/gif
--
-- Then add these storage policies (SQL Editor):
--
--   CREATE POLICY "avatar_select" ON storage.objects FOR SELECT
--     USING (bucket_id = 'avatars');
--
--   CREATE POLICY "avatar_insert" ON storage.objects FOR INSERT
--     WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
--
--   CREATE POLICY "avatar_update" ON storage.objects FOR UPDATE
--     USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
--
--   CREATE POLICY "avatar_delete" ON storage.objects FOR DELETE
--     USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
