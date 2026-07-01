-- Review page section layout — lets staff control which department sections
-- actively show up in the Review queue and in what order, shared live across
-- everyone on the Review page (see src/components/pages/ReviewPage.jsx +
-- app_settings realtime publication from migration 067).
-- Default = every department visible, in the same order as DEPTS in
-- src/lib/constants.js, matching the previous (unfiltered) behavior.
INSERT INTO app_settings (key, value) VALUES (
  'review_section_order',
  '["concept","modeling","texturing","rigging","animation","lighting","compositing","test_ai","sound"]'
)
ON CONFLICT (key) DO NOTHING;
