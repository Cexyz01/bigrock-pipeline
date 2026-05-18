-- Split storyboard creative-mode stickers between the Shots board and the Assets board.
-- Existing rows default to 'shots' (matches the only board that existed before).

ALTER TABLE storyboard_stickers
  ADD COLUMN IF NOT EXISTS board TEXT NOT NULL DEFAULT 'shots';

CREATE INDEX IF NOT EXISTS storyboard_stickers_project_board_idx
  ON storyboard_stickers (project_id, board);
