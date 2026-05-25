-- ============================================
-- 065: Storyboard single source of truth
-- ============================================
-- Previously the storyboard showed images from two unrelated sources:
--   (a) miro_wip_images — auto-populated latest WIP per (task, uploader)
--   (b) task_wip_updates.pinned_storyboard_urls — explicit "show in storyboard" stars
-- That meant an image could appear with NO star (via path a) — confusing UX.
--
-- New rule: the star is the ONLY source. When a task is approved, the app
-- auto-pins the latest WIP update per uploader (handled in updateTask). This
-- migration backfills the same default for tasks already approved so nothing
-- disappears from the storyboard after the cutover.

WITH latest_per_uploader AS (
  SELECT DISTINCT ON (w.task_id, w.user_id)
    w.id,
    COALESCE(w.images, '{}'::text[]) AS imgs
  FROM task_wip_updates w
  JOIN tasks t ON t.id = w.task_id
  WHERE t.status = 'approved'
  ORDER BY w.task_id, w.user_id, w.created_at DESC
)
UPDATE task_wip_updates u
SET pinned_storyboard_urls = sub.merged
FROM (
  SELECT
    lpu.id,
    (
      SELECT COALESCE(array_agg(DISTINCT x), '{}'::text[])
      FROM unnest(
        COALESCE(u2.pinned_storyboard_urls, '{}'::text[]) || lpu.imgs
      ) AS x
      WHERE x IS NOT NULL AND x <> ''
    ) AS merged
  FROM latest_per_uploader lpu
  JOIN task_wip_updates u2 ON u2.id = lpu.id
) sub
WHERE u.id = sub.id;
