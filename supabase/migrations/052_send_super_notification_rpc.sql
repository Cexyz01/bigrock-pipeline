-- Replace the fragile RLS-based super notifications insert with a
-- SECURITY DEFINER RPC. The RPC reads auth.uid() once, validates the
-- caller's role inline against profiles+roles, and inserts on their behalf.
-- This removes the dependency on auth.uid() being readable from the WITH
-- CHECK clause, which was failing intermittently for reasons that look
-- like JWT/cache races.

CREATE OR REPLACE FUNCTION public.send_super_notification(
  p_target_user_id uuid,
  p_message text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id uuid;
  caller_can boolean;
  new_id uuid;
BEGIN
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT (
    p.email IN ('davide.casinelli@bigrock.it', 'emanuele.cerni@bigrock.it')
    OR (r.permissions->>'create_projects')::boolean = true
    OR (r.permissions->>'manage_roles')::boolean = true
  )
  INTO caller_can
  FROM public.profiles p
  LEFT JOIN public.roles r ON r.id = p.role_id
  WHERE p.id = caller_id;

  IF NOT COALESCE(caller_can, false) THEN
    RAISE EXCEPTION 'insufficient_permissions' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.super_notifications (target_user_id, sender_id, message)
  VALUES (p_target_user_id, caller_id, p_message)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_super_notification(uuid, text) TO authenticated;
