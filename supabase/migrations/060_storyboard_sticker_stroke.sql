-- Allow kind='stroke' for pen-drawn freehand sticker.
-- Points are JSON-encoded in text_content (relative to bbox top-left),
-- text_color = stroke colour, font_size = brush thickness in px.

ALTER TABLE storyboard_stickers
  DROP CONSTRAINT IF EXISTS storyboard_stickers_kind_payload_chk;

ALTER TABLE storyboard_stickers
  ADD CONSTRAINT storyboard_stickers_kind_payload_chk CHECK (
    (kind = ANY (ARRAY['image'::text, 'text'::text, 'rect'::text, 'ellipse'::text, 'arrow'::text, 'stroke'::text]))
    AND ((kind <> 'image'::text) OR (image_url IS NOT NULL))
  );
