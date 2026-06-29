-- =============================================
-- 068: Chat attachments — any file type, up to 100MB (enforced client-side)
-- Files live on R2 (kind="chat"); we store an array of {url,name,type,size}.
-- body stays NOT NULL but may be '' when a message is attachment-only.
-- =============================================

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
