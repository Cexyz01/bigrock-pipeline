-- Timeline fields for shots
ALTER TABLE shots ADD COLUMN IF NOT EXISTS duration_frames int DEFAULT 120;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS video_url text;
