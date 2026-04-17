-- Add 3 new department enum values
ALTER TYPE department ADD VALUE IF NOT EXISTS 'lighting';
ALTER TYPE department ADD VALUE IF NOT EXISTS 'test_ai';
ALTER TYPE department ADD VALUE IF NOT EXISTS 'sound';

-- Add 3 new status columns to shots
ALTER TABLE shots ADD COLUMN IF NOT EXISTS status_lighting shot_status DEFAULT 'not_started';
ALTER TABLE shots ADD COLUMN IF NOT EXISTS status_test_ai shot_status DEFAULT 'not_started';
ALTER TABLE shots ADD COLUMN IF NOT EXISTS status_sound shot_status DEFAULT 'not_started';

-- Per-shot department enable/disable (JSONB map, default {} = all enabled)
-- Example: {"rigging": true, "sound": true} means those 2 are disabled
ALTER TABLE shots ADD COLUMN IF NOT EXISTS disabled_depts jsonb DEFAULT '{}'::jsonb;

-- Output file (second upload alongside reference)
ALTER TABLE shots ADD COLUMN IF NOT EXISTS output_cloud_url text;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS output_img_width int;
ALTER TABLE shots ADD COLUMN IF NOT EXISTS output_img_height int;
