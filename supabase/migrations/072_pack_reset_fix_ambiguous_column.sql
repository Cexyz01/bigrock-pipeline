-- ============================================
-- 072 — Fix "column reference available_packs is ambiguous"
-- pack_try_consume / pack_refund_consume used
-- `available_packs = available_packs - 1` style
-- expressions where the RETURNS TABLE output
-- parameter shares its name with the table column,
-- which Postgres can't disambiguate. Qualify with
-- the table alias on every read reference.
-- ============================================

CREATE OR REPLACE FUNCTION pack_try_consume()
RETURNS TABLE(ok boolean, available_packs int, next_reset_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid          uuid := auth.uid();
  current_slot timestamptz := pack_current_reset_slot(now());
  row_rec      pack_user_timers;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO row_rec FROM pack_user_timers pt WHERE pt.user_id = uid FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO pack_user_timers (user_id, available_packs, last_pack_at, last_reset_at)
    VALUES (uid, 3, now(), current_slot)
    RETURNING * INTO row_rec;
  ELSIF row_rec.last_reset_at IS NULL OR row_rec.last_reset_at < current_slot THEN
    UPDATE pack_user_timers pt
      SET available_packs = 3, last_reset_at = current_slot
      WHERE pt.user_id = uid
      RETURNING pt.* INTO row_rec;
  END IF;

  IF row_rec.available_packs <= 0 THEN
    RETURN QUERY SELECT false, row_rec.available_packs, pack_next_reset_slot(now());
    RETURN;
  END IF;

  UPDATE pack_user_timers pt
    SET available_packs = pt.available_packs - 1, last_pack_at = now()
    WHERE pt.user_id = uid
    RETURNING pt.* INTO row_rec;

  RETURN QUERY SELECT true, row_rec.available_packs, pack_next_reset_slot(now());
END;
$$;

CREATE OR REPLACE FUNCTION pack_refund_consume()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  UPDATE pack_user_timers pt SET available_packs = LEAST(3, pt.available_packs + 1) WHERE pt.user_id = uid;
END;
$$;

CREATE OR REPLACE FUNCTION pack_get_status()
RETURNS TABLE(available_packs int, next_reset_at timestamptz, server_now timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid          uuid := auth.uid();
  current_slot timestamptz := pack_current_reset_slot(now());
  row_rec      pack_user_timers;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO row_rec FROM pack_user_timers pt WHERE pt.user_id = uid FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO pack_user_timers (user_id, available_packs, last_pack_at, last_reset_at)
    VALUES (uid, 3, now(), current_slot)
    RETURNING * INTO row_rec;
  ELSIF row_rec.last_reset_at IS NULL OR row_rec.last_reset_at < current_slot THEN
    UPDATE pack_user_timers pt
      SET available_packs = 3, last_reset_at = current_slot
      WHERE pt.user_id = uid
      RETURNING pt.* INTO row_rec;
  END IF;

  RETURN QUERY SELECT row_rec.available_packs, pack_next_reset_slot(now()), now();
END;
$$;

GRANT EXECUTE ON FUNCTION pack_get_status() TO authenticated;
GRANT EXECUTE ON FUNCTION pack_try_consume() TO authenticated;
GRANT EXECUTE ON FUNCTION pack_refund_consume() TO authenticated;
