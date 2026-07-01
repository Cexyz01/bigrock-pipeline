-- ============================================
-- 071 — Pack timer → fixed daily reset schedule
-- Replaces the 60-min-per-pack countdown with 3
-- fixed resets/day (11:30, 14:30, 16:30 Europe/Rome).
-- Reset always sets available_packs = 3 (no
-- accumulation). All checks run server-side via
-- now() so a client's local clock cannot be used
-- to cheat the schedule.
-- ============================================

ALTER TABLE pack_user_timers
  ADD COLUMN IF NOT EXISTS last_reset_at timestamptz;

-- ── Schedule helpers ──

CREATE OR REPLACE FUNCTION pack_current_reset_slot(at_ts timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  local_ts   timestamp := at_ts AT TIME ZONE 'Europe/Rome';
  local_date date := local_ts::date;
  slot_times time[] := ARRAY['11:30'::time, '14:30'::time, '16:30'::time];
  slot       time;
  result     timestamptz := NULL;
BEGIN
  FOREACH slot IN ARRAY slot_times LOOP
    IF (local_date + slot) <= local_ts THEN
      result := (local_date + slot) AT TIME ZONE 'Europe/Rome';
    END IF;
  END LOOP;

  IF result IS NULL THEN
    -- Before today's first slot → last slot was yesterday's 16:30
    result := ((local_date - 1) + '16:30'::time) AT TIME ZONE 'Europe/Rome';
  END IF;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION pack_next_reset_slot(at_ts timestamptz DEFAULT now())
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  local_ts   timestamp := at_ts AT TIME ZONE 'Europe/Rome';
  local_date date := local_ts::date;
  slot_times time[] := ARRAY['11:30'::time, '14:30'::time, '16:30'::time];
  slot       time;
BEGIN
  FOREACH slot IN ARRAY slot_times LOOP
    IF (local_date + slot) > local_ts THEN
      RETURN (local_date + slot) AT TIME ZONE 'Europe/Rome';
    END IF;
  END LOOP;

  -- All of today's slots have passed → tomorrow's 11:30
  RETURN ((local_date + 1) + '11:30'::time) AT TIME ZONE 'Europe/Rome';
END;
$$;

-- ── Status (lazy refill on read) ──

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

  SELECT * INTO row_rec FROM pack_user_timers WHERE user_id = uid FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO pack_user_timers (user_id, available_packs, last_pack_at, last_reset_at)
    VALUES (uid, 3, now(), current_slot)
    RETURNING * INTO row_rec;
  ELSIF row_rec.last_reset_at IS NULL OR row_rec.last_reset_at < current_slot THEN
    UPDATE pack_user_timers
      SET available_packs = 3, last_reset_at = current_slot
      WHERE user_id = uid
      RETURNING * INTO row_rec;
  END IF;

  RETURN QUERY SELECT row_rec.available_packs, pack_next_reset_slot(now()), now();
END;
$$;

-- ── Atomic consume (refill-if-needed + decrement in one transaction) ──

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

  SELECT * INTO row_rec FROM pack_user_timers WHERE user_id = uid FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO pack_user_timers (user_id, available_packs, last_pack_at, last_reset_at)
    VALUES (uid, 3, now(), current_slot)
    RETURNING * INTO row_rec;
  ELSIF row_rec.last_reset_at IS NULL OR row_rec.last_reset_at < current_slot THEN
    UPDATE pack_user_timers
      SET available_packs = 3, last_reset_at = current_slot
      WHERE user_id = uid
      RETURNING * INTO row_rec;
  END IF;

  IF row_rec.available_packs <= 0 THEN
    RETURN QUERY SELECT false, row_rec.available_packs, pack_next_reset_slot(now());
    RETURN;
  END IF;

  UPDATE pack_user_timers
    SET available_packs = available_packs - 1, last_pack_at = now()
    WHERE user_id = uid
    RETURNING * INTO row_rec;

  RETURN QUERY SELECT true, row_rec.available_packs, pack_next_reset_slot(now());
END;
$$;

-- ── Refund (used if the physical pack claim fails after a slot was consumed) ──

CREATE OR REPLACE FUNCTION pack_refund_consume()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  UPDATE pack_user_timers SET available_packs = LEAST(3, available_packs + 1) WHERE user_id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION pack_current_reset_slot(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION pack_next_reset_slot(timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION pack_get_status() TO authenticated;
GRANT EXECUTE ON FUNCTION pack_try_consume() TO authenticated;
GRANT EXECUTE ON FUNCTION pack_refund_consume() TO authenticated;
