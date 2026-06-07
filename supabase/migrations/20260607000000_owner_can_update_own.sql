-- Allow authenticated users to update their own shared creations.
-- Powers locking the draw / editing content as the signed-in account owner,
-- without needing the admin token stored on the device. Scoped both ways to
-- owner_user_id = auth.uid() so a user can only ever change their own rows and
-- cannot reassign ownership to someone else.

DROP POLICY IF EXISTS "owner_can_update_own" ON shared_creations;
CREATE POLICY "owner_can_update_own"
  ON shared_creations FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
