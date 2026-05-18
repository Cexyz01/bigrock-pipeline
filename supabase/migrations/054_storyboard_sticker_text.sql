-- Allow text-only stickers (kind='text') alongside image stickers.
-- image_url may be NULL when kind='text'.

ALTER TABLE storyboard_stickers
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'image';

ALTER TABLE storyboard_stickers
  ADD COLUMN IF NOT EXISTS text_content TEXT;

ALTER TABLE storyboard_stickers
  ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT '#1a1a1a';

ALTER TABLE storyboard_stickers
  ADD COLUMN IF NOT EXISTS bg_color TEXT DEFAULT '#FEF3C7';

ALTER TABLE storyboard_stickers
  ADD COLUMN IF NOT EXISTS font_size INTEGER DEFAULT 18;

ALTER TABLE storyboard_stickers
  ALTER COLUMN image_url DROP NOT NULL;

ALTER TABLE storyboard_stickers
  DROP CONSTRAINT IF EXISTS storyboard_stickers_kind_payload_chk;

ALTER TABLE storyboard_stickers
  ADD CONSTRAINT storyboard_stickers_kind_payload_chk
    CHECK (
      (kind = 'image' AND image_url IS NOT NULL)
      OR (kind = 'text'  AND text_content IS NOT NULL)
    );
