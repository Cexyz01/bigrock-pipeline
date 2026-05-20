-- wip_comments had RLS enabled but only a SELECT policy, so every INSERT
-- was being silently rejected — staff feedback typed into the per-WIP
-- "Add feedback…" box never reached the database.

DROP POLICY IF EXISTS wip_comments_insert ON wip_comments;
CREATE POLICY wip_comments_insert ON wip_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- Authors (and staff) can clean up their own comments.
DROP POLICY IF EXISTS wip_comments_delete ON wip_comments;
CREATE POLICY wip_comments_delete ON wip_comments
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role <> 'studente')
  );
