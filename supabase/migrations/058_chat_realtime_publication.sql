-- ============================================
-- Add chat tables to supabase_realtime publication
-- ============================================
-- Without this, postgres_changes INSERT events never reach the client,
-- so chat messages and DMs only appear via polling (5s) or page reload.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND tablename='chat_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname='supabase_realtime' AND tablename='direct_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE direct_messages';
  END IF;
END $$;

-- REPLICA IDENTITY FULL so filtered subscriptions (project_id, recipient_id)
-- also work for UPDATE/DELETE, and so the row is published in full.
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
ALTER TABLE direct_messages REPLICA IDENTITY FULL;
