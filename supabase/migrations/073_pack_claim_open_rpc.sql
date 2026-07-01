-- ============================================
-- 073 — Server-side pack claim/open RPC
--
-- Root cause of "students can't open packs": pack_generated_packs RLS only
-- lets students SELECT/UPDATE rows already assigned_to = auth.uid(). An
-- unassigned pack (assigned_to IS NULL) is invisible to them, so the
-- client-side claim (SELECT ... is('assigned_to', null) then UPDATE) always
-- returned 0 rows for students — pack_try_consume decremented available_packs,
-- the claim silently failed, and pack_refund_consume bounced it back to 3.
-- Only staff (role != 'studente') could ever actually claim a pack.
--
-- Fix: do the whole open (consume slot + claim pack + grant cards) inside one
-- SECURITY DEFINER function so it runs with elevated privileges regardless of
-- the caller's RLS visibility, same pattern as pack_try_consume.
-- ============================================

CREATE OR REPLACE FUNCTION pack_claim_open(p_pack_type text)
RETURNS TABLE(
  ok boolean,
  reason text,
  next_reset_at timestamptz,
  id uuid,
  pack_number int,
  pack_type text,
  cards jsonb,
  opened_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid          uuid := auth.uid();
  consume_ok   boolean;
  consume_next timestamptz;
  claimed_row  pack_generated_packs;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT c.ok, c.next_reset_at INTO consume_ok, consume_next FROM pack_try_consume() c;

  IF NOT consume_ok THEN
    RETURN QUERY SELECT false, 'no_packs', consume_next,
      NULL::uuid, NULL::int, NULL::text, NULL::jsonb, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT * INTO claimed_row FROM pack_generated_packs pg
    WHERE pg.pack_type = p_pack_type AND pg.assigned_to IS NULL
    FOR UPDATE SKIP LOCKED
    LIMIT 1;

  IF NOT FOUND THEN
    PERFORM pack_refund_consume();
    RETURN QUERY SELECT false, 'sold_out', consume_next,
      NULL::uuid, NULL::int, NULL::text, NULL::jsonb, NULL::timestamptz;
    RETURN;
  END IF;

  UPDATE pack_generated_packs pg
    SET assigned_to = uid, opened = true, opened_at = now()
    WHERE pg.id = claimed_row.id
    RETURNING * INTO claimed_row;

  INSERT INTO pack_user_cards (user_id, card_number, copy_number, obtained_via)
  SELECT uid, (entry->>'card')::int, (entry->>'copy')::int, 'pack'
  FROM jsonb_array_elements(claimed_row.cards) AS entry
  ON CONFLICT (user_id, card_number, copy_number) DO NOTHING;

  RETURN QUERY SELECT true, NULL::text, consume_next,
    claimed_row.id, claimed_row.pack_number, claimed_row.pack_type, claimed_row.cards, claimed_row.opened_at;
END;
$$;

GRANT EXECUTE ON FUNCTION pack_claim_open(text) TO authenticated;
