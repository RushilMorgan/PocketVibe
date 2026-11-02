-- ─────────────────────────────────────────────────────────────────────────────
-- HeyToolie — weekly digest (SPEC Phase 4). One row per user per week; the
-- digest page and email render `content`. opened_at is set on the first
-- tracked tap (the day-30 test counts digests opened, not taps).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digests (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start  date        NOT NULL,
  content     jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  sent_at     timestamptz,
  opened_at   timestamptz,
  UNIQUE (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS digests_user_created_idx ON digests (user_id, created_at DESC);

ALTER TABLE digests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_digests" ON digests
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
