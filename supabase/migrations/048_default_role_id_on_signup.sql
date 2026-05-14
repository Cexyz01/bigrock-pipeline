-- Make sure new accounts start with a real role_id, not just role='studente' text.
-- Migration 033 introduced role_id but didn't update the auth trigger, so every
-- new Google login lands with role_id=NULL and shows up as "unassigned" in the
-- permission UI even though the role text says studente.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  studente_role_id uuid;
BEGIN
  SELECT id INTO studente_role_id FROM roles WHERE slug = 'studente' LIMIT 1;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, role, role_id)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', 'Unknown'),
    new.raw_user_meta_data ->> 'avatar_url',
    'studente',
    studente_role_id
  );
  RETURN new;
END;
$$;

-- Backfill: anyone currently with role_id IS NULL becomes a studente.
UPDATE profiles
   SET role_id = (SELECT id FROM roles WHERE slug = 'studente')
 WHERE role_id IS NULL;
