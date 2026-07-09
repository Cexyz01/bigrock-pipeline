-- Studio (office) page: per-student pixel avatar choice (0-5 = MetroCity char sheet index).
-- Set by admins from the Studio view so the on-screen character matches the person.
alter table public.profiles
  add column if not exists studio_avatar smallint;
