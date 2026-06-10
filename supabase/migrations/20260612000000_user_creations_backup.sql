-- Cloud backup of local creations for signed-in users.
-- Powers "keep your tools safe on any device": every local creation is backed
-- up here while signed in, and pulled+merged on sign-in (newest wins).
-- Owner-only via RLS; clients read/write directly (no edge function needed).

CREATE TABLE IF NOT EXISTS user_creations (
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creation_id   text        NOT NULL,
  data          jsonb       NOT NULL,
  updated_at_ms bigint      NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, creation_id)
);

ALTER TABLE user_creations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own_backups_only" ON user_creations;
CREATE POLICY "own_backups_only"
  ON user_creations FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
