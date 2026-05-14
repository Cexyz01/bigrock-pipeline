-- The handle_new_user trigger looks up the studente role by slug, but when
-- called from GoTrue (supabase_auth_admin role) the SELECT was failing
-- because the function ran without a deterministic search_path and couldn't
-- resolve `roles` reliably. Direct SQL inserts worked because the calling
-- session had public in its search_path; GoTrue's session did not.
--
-- Setting an explicit search_path on the function makes both paths behave
-- identically, so admin.createUser (and OAuth signups) no longer fail with
-- "Database error creating new user".

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  studente_role_id uuid;
BEGIN
  SELECT id INTO studente_role_id FROM public.roles WHERE slug = 'studente' LIMIT 1;

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
