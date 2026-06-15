-- ─────────────────────────────────────────────────────────────────────────────
-- Hey Toolie — Web Push subscriptions
-- One row per browser/device push endpoint. Anonymous users are supported
-- (user_id NULL) so a notification can fire for a not-yet-signed-in visitor who
-- enabled notifications. The pocketvibe-push edge function reads these with the
-- service role (bypassing RLS) to send.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint    text        PRIMARY KEY,          -- the push service URL (unguessable)
  user_id     uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  p256dh      text        NOT NULL,             -- subscription public key
  auth        text        NOT NULL,             -- subscription auth secret
  user_agent  text,                             -- best-effort device label
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON push_subscriptions (user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Registration: a client may write a row for itself (anonymous) or for the
-- signed-in user. The endpoint is an unguessable secret, so allowing anon rows
-- is safe. The matching update/delete policies let a client refresh or revoke
-- its own subscription (anonymous rows keyed only by their secret endpoint).
CREATE POLICY "register_own_subscription"
  ON push_subscriptions
  FOR INSERT
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "refresh_own_subscription"
  ON push_subscriptions
  FOR UPDATE
  USING      (user_id IS NULL OR auth.uid() = user_id)
  WITH CHECK (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "revoke_own_subscription"
  ON push_subscriptions
  FOR DELETE
  USING (user_id IS NULL OR auth.uid() = user_id);
