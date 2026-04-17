-- ============================================
-- 030: Super Notifications system
-- ============================================

CREATE TABLE super_notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  target_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  message text NOT NULL,
  seen boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE super_notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own super notifications
CREATE POLICY "sn_select_own" ON super_notifications
  FOR SELECT USING (target_user_id = auth.uid());

-- Admins can insert
CREATE POLICY "sn_insert_admin" ON super_notifications
  FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- Users can update their own (to mark seen)
CREATE POLICY "sn_update_own" ON super_notifications
  FOR UPDATE USING (target_user_id = auth.uid());

-- Admins can read all (for admin panel)
CREATE POLICY "sn_select_admin" ON super_notifications
  FOR SELECT USING (is_admin(auth.uid()));

CREATE INDEX idx_super_notif_target ON super_notifications(target_user_id, seen);
