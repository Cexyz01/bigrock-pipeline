-- Force-reload flag — lets an admin push a reload to every open tab on
-- demand, instead of every deploy auto-reloading everyone's session (too
-- disruptive with dozens of students potentially online for a change
-- nobody else can even see). main.jsx polls this key at boot + every 60s;
-- bumping it to a newer value (see scripts/force-reload.mjs) makes every
-- open tab reload on its next poll/focus.
INSERT INTO app_settings (key, value) VALUES ('force_reload_at', '1970-01-01T00:00:00.000Z')
ON CONFLICT (key) DO NOTHING;
