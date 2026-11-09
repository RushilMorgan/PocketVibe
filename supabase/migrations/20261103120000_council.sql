-- ─────────────────────────────────────────────────────────────────────────────
-- HeyToolie — the Council: ideas stress-tested by several AI models.
-- council_sessions holds the idea and the ratified report; council_turns holds
-- every model's output per stage (the "how they got there" transcript, and
-- the job's cache: a re-run reuses turns already written). Round 0 is the
-- first pass; each follow-up is the next round. Additive only.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS council_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idea        text        NOT NULL,
  title       text,
  status      text        NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  stage       text        NOT NULL DEFAULT 'frame',
  error       text,
  report      jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS council_sessions_user_idx ON council_sessions (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS council_turns (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES council_sessions(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round       integer     NOT NULL DEFAULT 0,
  stage       text        NOT NULL,
  member      text        NOT NULL,
  model       text        NOT NULL,
  content     jsonb       NOT NULL,
  cost_usd    numeric(10, 6) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, round, stage, member)
);

CREATE INDEX IF NOT EXISTS council_turns_session_idx ON council_turns (session_id, round, created_at);

ALTER TABLE council_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_council_sessions" ON council_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_allowlisted())
  WITH CHECK (auth.uid() = user_id AND public.is_allowlisted());

CREATE POLICY "own_council_turns" ON council_turns FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_allowlisted())
  WITH CHECK (auth.uid() = user_id AND public.is_allowlisted());

-- Same trigger as items/users keeps updated_at honest.
DROP TRIGGER IF EXISTS council_sessions_updated_at ON council_sessions;
CREATE TRIGGER council_sessions_updated_at BEFORE UPDATE ON council_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
