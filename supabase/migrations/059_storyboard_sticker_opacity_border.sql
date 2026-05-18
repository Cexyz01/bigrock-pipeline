-- Per-sticker opacity (0..1) and border thickness (px), used by rect/ellipse shapes
-- in the storyboard creative mode. Existing rows keep their current look (opacity 1,
-- border 2px); new rect/ellipse stickers are inserted with opacity=0.5 and
-- border_width=1 so they read as soft background frames.

ALTER TABLE storyboard_stickers
  ADD COLUMN IF NOT EXISTS opacity NUMERIC NOT NULL DEFAULT 1.0;

ALTER TABLE storyboard_stickers
  ADD COLUMN IF NOT EXISTS border_width INTEGER NOT NULL DEFAULT 2;
