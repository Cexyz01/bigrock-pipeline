-- ============================================
-- Restore missing INSERT policy on direct_messages
-- ============================================
-- The original policy from migration 002 was dropped along the way, so
-- RLS denied every DM insert. Re-create it: sender must be authed and
-- at least one party (sender or recipient) must be staff. This already
-- covers staff↔staff (sender is staff) and staff↔student.

DROP POLICY IF EXISTS "dm_insert" ON direct_messages;

CREATE POLICY "dm_insert" ON direct_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id
  AND (
    is_staff(auth.uid())
    OR is_staff(recipient_id)
  )
);
