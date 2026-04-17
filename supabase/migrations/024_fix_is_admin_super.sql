-- ============================================
-- 024: Fix is_admin to include super_admin role
-- ============================================

CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Also update is_staff to include super_admin
CREATE OR REPLACE FUNCTION is_staff(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id AND role IN ('admin', 'super_admin', 'docente', 'coordinatore')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
