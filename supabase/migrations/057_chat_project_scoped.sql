-- ============================================
-- Chat scoped to projects + per-project departments
-- ============================================
-- Wire chat_messages to the current role/assignment model:
--   * Each message belongs to a project (project_id)
--   * Channel "general" = project-wide, all project_members can read/write
--   * Channel "<dept>"  = only project_members whose project_role = <dept>,
--     or staff (admin/coordinator/etc.)

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS chat_messages_project_channel_idx
  ON chat_messages (project_id, channel, created_at);

-- Backfill legacy rows: assign them to the oldest existing project so old
-- chats remain visible to that project's members. If no projects exist,
-- legacy rows stay with project_id IS NULL (visible only to staff).
UPDATE chat_messages
   SET project_id = (SELECT id FROM projects ORDER BY created_at ASC LIMIT 1)
 WHERE project_id IS NULL;

-- Replace old RLS policies with project-aware ones
DROP POLICY IF EXISTS "chat_select" ON chat_messages;
DROP POLICY IF EXISTS "chat_insert" ON chat_messages;

CREATE POLICY "chat_select" ON chat_messages FOR SELECT USING (
  is_staff(auth.uid())
  OR (
    project_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM project_members pm
       WHERE pm.project_id = chat_messages.project_id
         AND pm.user_id = auth.uid()
         AND (
           chat_messages.channel = 'general'
           OR pm.project_role = chat_messages.channel
         )
    )
  )
);

CREATE POLICY "chat_insert" ON chat_messages FOR INSERT WITH CHECK (
  auth.uid() = author_id
  AND project_id IS NOT NULL
  AND (
    is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM project_members pm
       WHERE pm.project_id = chat_messages.project_id
         AND pm.user_id = auth.uid()
         AND (
           chat_messages.channel = 'general'
           OR pm.project_role = chat_messages.channel
         )
    )
  )
);
