-- Fix: staff reviewers couldn't persist the Review page section layout.
--
-- Migration 069 replaced app_settings' original is_staff() write policies
-- with is_admin()-only ones (so only admins can flip maintenance_mode /
-- force_reload_at). That also locked NON-admin staff out of writing the
-- 'review_section_order' key — but the Review section manager is a staff
-- tool (see migration 070 + src/components/pages/ReviewPage.jsx). Their
-- drags hit an RLS denial that setReviewSectionOrder() swallowed silently,
-- so the layout reverted to whatever was last persisted on every reload.
--
-- Restore staff write access, but scoped to ONLY the review_section_order
-- key so maintenance_mode / force_reload_at stay admin-only. Permissive
-- policies are OR'd together, so this widens (never narrows) who can write
-- that one key.

DROP POLICY IF EXISTS "settings_staff_review_order_insert" ON app_settings;
DROP POLICY IF EXISTS "settings_staff_review_order_update" ON app_settings;

CREATE POLICY "settings_staff_review_order_insert" ON app_settings
  FOR INSERT
  WITH CHECK (key = 'review_section_order' AND is_staff());

CREATE POLICY "settings_staff_review_order_update" ON app_settings
  FOR UPDATE
  USING (key = 'review_section_order' AND is_staff())
  WITH CHECK (key = 'review_section_order' AND is_staff());

-- Reset the currently-stuck value (['rigging'], an artifact of the failed
-- writes above) back to the full default so the page shows every section
-- again. Staff can now re-arrange it and it will persist.
UPDATE app_settings
SET value = '["concept","modeling","texturing","rigging","animation","lighting","compositing","test_ai","sound"]',
    updated_at = now()
WHERE key = 'review_section_order';
