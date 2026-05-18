-- Allow rect / ellipse / arrow stickers alongside image and text.
-- Rectangles & ellipses are styled boxes (bg_color = fill, text_color = stroke, font_size
-- = stroke width, text_content = optional label).
-- Arrows are line stickers from (x,y) to (x+w, y+h). w/h may be negative.

ALTER TABLE storyboard_stickers
  DROP CONSTRAINT IF EXISTS storyboard_stickers_kind_payload_chk;

ALTER TABLE storyboard_stickers
  ADD CONSTRAINT storyboard_stickers_kind_payload_chk
    CHECK (
      kind IN ('image', 'text', 'rect', 'ellipse', 'arrow')
      AND (kind != 'image' OR image_url IS NOT NULL)
    );
