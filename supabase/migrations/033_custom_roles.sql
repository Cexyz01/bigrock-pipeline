-- =============================================
-- 033: Custom Roles & Permissions System
-- =============================================

-- 1. Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '{}',
  is_preset boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies: everyone can read, only super admins can modify
CREATE POLICY "roles_select" ON roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "roles_insert" ON roles FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email IN ('davide.casinelli@bigrock.it', 'emanuele.cerni@bigrock.it'))
    OR EXISTS (SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id WHERE p.id = auth.uid() AND (r.permissions->>'manage_roles')::boolean = true)
  );

CREATE POLICY "roles_update" ON roles FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email IN ('davide.casinelli@bigrock.it', 'emanuele.cerni@bigrock.it'))
    OR EXISTS (SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id WHERE p.id = auth.uid() AND (r.permissions->>'manage_roles')::boolean = true)
  );

CREATE POLICY "roles_delete" ON roles FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND email IN ('davide.casinelli@bigrock.it', 'emanuele.cerni@bigrock.it'))
    OR EXISTS (SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id WHERE p.id = auth.uid() AND (r.permissions->>'manage_roles')::boolean = true)
  );

-- 4. Seed preset roles
INSERT INTO roles (name, slug, description, permissions, is_preset) VALUES
  ('Admin', 'admin', 'Accesso completo a tutte le funzionalità', '{
    "manage_roles": true, "manage_users": true,
    "create_projects": true, "delete_projects": true, "manage_project_settings": true, "manage_project_members": true,
    "create_edit_shots": true, "delete_shots": true, "upload_media": true,
    "create_edit_tasks": true, "delete_tasks": true,
    "access_review": true, "access_timeline": true, "access_activity": true,
    "manage_calendar": true, "manage_tcg": true, "send_notifications": true, "access_admin_console": true
  }'::jsonb, true),
  ('Docente', 'docente', 'Gestione shots, tasks, review e timeline', '{
    "manage_roles": false, "manage_users": false,
    "create_projects": false, "delete_projects": false, "manage_project_settings": false, "manage_project_members": true,
    "create_edit_shots": true, "delete_shots": false, "upload_media": true,
    "create_edit_tasks": true, "delete_tasks": false,
    "access_review": true, "access_timeline": true, "access_activity": true,
    "manage_calendar": true, "manage_tcg": false, "send_notifications": false, "access_admin_console": false
  }'::jsonb, true),
  ('Coordinatore', 'coordinatore', 'Gestione shots, tasks e timeline', '{
    "manage_roles": false, "manage_users": false,
    "create_projects": false, "delete_projects": false, "manage_project_settings": false, "manage_project_members": false,
    "create_edit_shots": true, "delete_shots": false, "upload_media": true,
    "create_edit_tasks": true, "delete_tasks": false,
    "access_review": false, "access_timeline": true, "access_activity": true,
    "manage_calendar": true, "manage_tcg": false, "send_notifications": false, "access_admin_console": false
  }'::jsonb, true),
  ('Studente', 'studente', 'Accesso base con upload media', '{
    "manage_roles": false, "manage_users": false,
    "create_projects": false, "delete_projects": false, "manage_project_settings": false, "manage_project_members": false,
    "create_edit_shots": false, "delete_shots": false, "upload_media": true,
    "create_edit_tasks": false, "delete_tasks": false,
    "access_review": false, "access_timeline": false, "access_activity": false,
    "manage_calendar": false, "manage_tcg": false, "send_notifications": false, "access_admin_console": false
  }'::jsonb, true)
ON CONFLICT (slug) DO NOTHING;

-- 5. Add role_id to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES roles(id) ON DELETE SET NULL;

-- 6. Backfill role_id from existing role text
UPDATE profiles SET role_id = (SELECT id FROM roles WHERE slug = 'admin') WHERE role IN ('admin', 'super_admin') AND role_id IS NULL;
UPDATE profiles SET role_id = (SELECT id FROM roles WHERE slug = 'docente') WHERE role = 'docente' AND role_id IS NULL;
UPDATE profiles SET role_id = (SELECT id FROM roles WHERE slug = 'coordinatore') WHERE role = 'coordinatore' AND role_id IS NULL;
UPDATE profiles SET role_id = (SELECT id FROM roles WHERE slug = 'studente') WHERE role = 'studente' AND role_id IS NULL;
-- Default: anyone without a role gets studente
UPDATE profiles SET role_id = (SELECT id FROM roles WHERE slug = 'studente') WHERE role_id IS NULL;

-- 7. Create has_permission function
CREATE OR REPLACE FUNCTION has_permission(user_id uuid, perm text)
RETURNS boolean AS $$
BEGIN
  -- Super admin always has all permissions
  IF EXISTS (SELECT 1 FROM profiles WHERE id = user_id AND email IN ('davide.casinelli@bigrock.it', 'emanuele.cerni@bigrock.it')) THEN
    RETURN true;
  END IF;
  -- Check role permissions
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = user_id
    AND (r.permissions->>perm)::boolean = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 8. Update is_admin to use roles table
CREATE OR REPLACE FUNCTION is_admin(uid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  -- Super admin by email
  IF EXISTS (SELECT 1 FROM profiles WHERE id = uid AND email IN ('davide.casinelli@bigrock.it', 'emanuele.cerni@bigrock.it')) THEN
    RETURN true;
  END IF;
  -- Check if role has manage_roles permission (admin-level)
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = uid
    AND (r.permissions->>'manage_roles')::boolean = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 9. Update is_staff to use roles table
CREATE OR REPLACE FUNCTION is_staff(uid uuid DEFAULT auth.uid())
RETURNS boolean AS $$
BEGIN
  -- Super admin
  IF EXISTS (SELECT 1 FROM profiles WHERE id = uid AND email IN ('davide.casinelli@bigrock.it', 'emanuele.cerni@bigrock.it')) THEN
    RETURN true;
  END IF;
  -- Staff = has any non-student permission (role slug != studente)
  RETURN EXISTS (
    SELECT 1 FROM profiles p
    JOIN roles r ON r.id = p.role_id
    WHERE p.id = uid
    AND r.slug != 'studente'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
