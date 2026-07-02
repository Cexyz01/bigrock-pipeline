-- ============================================
-- 074 — Server-side remaining-pack counts
--
-- getPacksRemaining() counted unassigned packs client-side with
-- COUNT(*) WHERE assigned_to IS NULL. But pack_generated_packs RLS hides
-- unassigned rows from students (and from anyone whose legacy profiles.role
-- is 'studente', e.g. the stale-role producer account), so those users always
-- saw {red:0, green:0, blue:0}. PackShop gates clickability on
-- remaining[type] > 0, so a 0 count meant the pack never became clickable —
-- no pointer cursor, no open — even though packs were plentiful.
--
-- Expose the true counts via a SECURITY DEFINER RPC that bypasses RLS. This is
-- inventory-level info (how many packs are left in each pool), not per-user
-- data, so it's fine for every authenticated user to read it.
-- ============================================

CREATE OR REPLACE FUNCTION pack_remaining_counts()
RETURNS TABLE(pack_type text, remaining bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg.pack_type, count(*)
  FROM pack_generated_packs pg
  WHERE pg.assigned_to IS NULL
  GROUP BY pg.pack_type;
$$;

GRANT EXECUTE ON FUNCTION pack_remaining_counts() TO authenticated;
