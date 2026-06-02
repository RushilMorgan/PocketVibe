-- Allow authenticated users to delete their own shared creations.
-- Powers the "Remove" action on the My things page. Scoped to
-- owner_user_id = auth.uid() so a user can only ever delete their own tools.

DROP POLICY IF EXISTS "owner_can_delete_own" ON shared_creations;
CREATE POLICY "owner_can_delete_own"
  ON shared_creations FOR DELETE
  TO authenticated
  USING (owner_user_id = auth.uid());
