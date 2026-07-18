-- =============================================
-- 075: Allow external (gmail.com) professors
-- =============================================
-- Adds two external professors for the "Notturno" project:
--   - salinriccardo.red@gmail.com       (Sound)
--   - enricoscattomusic@gmail.com       (Sound)
--
-- The handle_new_user trigger is updated so that when these specific emails
-- sign up via Google OAuth they receive the "docente" role and department
-- "sound" automatically (instead of the default "studente").
--
-- After their first login, assign them to the "Notturno" project via the
-- admin UI > Members tab (project_members rows are runtime data, not migrations).

-- 1. Update handle_new_user to auto-assign docente role for allowed external emails
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_role_id   uuid;
  target_role_slug text;
  target_dept      text;
BEGIN
  -- External professors: auto-assign docente + sound
  IF new.email IN ('salinriccardo.red@gmail.com', 'enricoscattomusic@gmail.com') THEN
    SELECT id INTO target_role_id FROM public.roles WHERE slug = 'docente' LIMIT 1;
    target_role_slug := 'docente';
    target_dept      := 'sound';
  ELSE
    SELECT id INTO target_role_id FROM public.roles WHERE slug = 'studente' LIMIT 1;
    target_role_slug := 'studente';
    target_dept      := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, role_id, department)
  VALUES (
        new.id,
        new.email,
        coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'Unknown'),
        new.raw_user_meta_data ->> 'avatar_url',
        target_role_slug,
        target_role_id,
        target_dept
      );
  RETURN new;
END;
$$;

-- 2. If these professors have ALREADY signed in (profiles exist as studente),
--    upgrade them in place. This is idempotent -- safe to run multiple times.
UPDATE profiles
SET role    = 'docente',
    role_id = (SELECT id FROM roles WHERE slug = 'docente' LIMIT 1),
    department = 'sound'
WHERE email IN ('salinriccardo.red@gmail.com', 'enricoscattomusic@gmail.com')
  AND role = 'studente';
