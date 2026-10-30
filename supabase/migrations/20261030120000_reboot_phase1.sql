-- ─────────────────────────────────────────────────────────────────────────────
-- HeyToolie reboot — Phase 1 schema (see SPEC.md → Data model)
--
--   allowed_emails      who may sign up (the strangers-test switch)
--   users               one row per person, created on first sign-in
--   push_devices        one row per browser push endpoint
--   items               one row per shared link
--   item_outputs        everything generated for an item
--   chunks              embedded text for chat retrieval + "similar"
--   topics              the interest profile
--   item_topics         which topics an item was tagged with
--   events              behaviour log for the day-30 success test
--
-- Every user-data table carries user_id and RLS is `user_id = auth.uid()`.
-- Server code (API routes, Inngest jobs) uses the service role.
-- Legacy tables from the old site are left in place; dropping them is a
-- separate, explicitly-approved migration.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Shared trigger: keep updated_at honest.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── allowed_emails ───────────────────────────────────────────────────────────
-- Enforced at the auth layer by hook_before_user_created (below), so a direct
-- signInWithOtp call with the public anon key can't create an account either.
-- Opening to strangers = disable the hook in Auth → Hooks.
CREATE TABLE IF NOT EXISTS allowed_emails (
  email       text        PRIMARY KEY CHECK (email = lower(email)),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE allowed_emails ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role and the auth hook read it.

CREATE OR REPLACE FUNCTION hook_before_user_created(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM allowed_emails
    WHERE email = lower(event -> 'user' ->> 'email')
  ) THEN
    RETURN '{}'::jsonb;
  END IF;
  RETURN jsonb_build_object(
    'error', jsonb_build_object('http_code', 403, 'message', 'HeyToolie is invite-only for now.')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION hook_before_user_created(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION hook_before_user_created(jsonb) FROM PUBLIC, anon, authenticated;
GRANT SELECT ON allowed_emails TO supabase_auth_admin;

-- ── users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text        NOT NULL,
  display_name  text,
  level         text        NOT NULL DEFAULT 'some-code'
                            CHECK (level IN ('beginner', 'some-code', 'dev')),
  tone          text        NOT NULL DEFAULT 'friendly',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── push_devices ─────────────────────────────────────────────────────────────
-- One row per device rather than a single users.push_subscription column, so
-- phone + laptop can both be notified. Dead endpoints (404/410) are deleted by
-- the sender.
CREATE TABLE IF NOT EXISTS push_devices (
  endpoint    text        PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  p256dh      text        NOT NULL,
  auth        text        NOT NULL,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_devices_user_idx ON push_devices (user_id);

-- ── items ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url         text        NOT NULL,
  source      text        NOT NULL
                          CHECK (source IN ('youtube', 'article', 'tiktok', 'other')),
  kind        text        CHECK (kind IN ('recipe', 'tech', 'news', 'other')),   -- NULL until classified
  title       text,
  status      text        NOT NULL DEFAULT 'queued'
                          CHECK (status IN ('queued', 'processing', 'done', 'failed')),
  error       text,                                   -- backs "Couldn't read that one" + Retry
  raw_text    text,
  summary     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS items_user_created_idx ON items (user_id, created_at DESC);

CREATE TRIGGER items_updated_at BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── item_outputs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS item_outputs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('recipe', 'explainer', 'diagram', 'lesson')),
  content     jsonb       NOT NULL,
  file_url    text,                                   -- diagram PNG in Storage (Phase 2)
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS item_outputs_item_idx ON item_outputs (item_id, type);

-- ── chunks ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chunks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text        text        NOT NULL,
  embedding   extensions.vector(768) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chunks_item_idx ON chunks (item_id);
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON chunks USING hnsw (embedding extensions.vector_cosine_ops);

-- ── topics ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS topics (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  embedding     extensions.vector(768),
  weight        real        NOT NULL DEFAULT 0,
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS topics_user_name_idx ON topics (user_id, lower(name));
CREATE INDEX IF NOT EXISTS topics_user_weight_idx ON topics (user_id, weight DESC);

-- ── item_topics ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS item_topics (
  item_id   uuid NOT NULL REFERENCES items(id)  ON DELETE CASCADE,
  topic_id  uuid NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, topic_id)
);

CREATE INDEX IF NOT EXISTS item_topics_topic_idx ON item_topics (topic_id);

-- ── events ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id     uuid        REFERENCES items(id) ON DELETE SET NULL,
  type        text        NOT NULL
                          CHECK (type IN ('saved', 'opened', 'played', 'score', 'thumbs', 'digest_open')),
  value       numeric,                                -- score, +1/-1 for thumbs, …
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_user_type_created_idx ON events (user_id, type, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE chunks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_topics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE events       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_user_row" ON users
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "own_push_devices" ON push_devices
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_items" ON items
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_item_outputs" ON item_outputs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_chunks" ON chunks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_topics" ON topics
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_item_topics" ON item_topics
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own_events" ON events
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── Server-side helpers (service role only) ──────────────────────────────────
-- user_id is an explicit argument because these run under the service role.

-- "Ask my library" + "Similar": top-k chunks for one user by cosine similarity.
CREATE OR REPLACE FUNCTION match_chunks(
  p_user_id      uuid,
  p_embedding    extensions.vector(768),
  p_match_count  int  DEFAULT 8,
  p_exclude_item uuid DEFAULT NULL
)
RETURNS TABLE (id uuid, item_id uuid, text text, similarity float)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT c.id, c.item_id, c.text, 1 - (c.embedding <=> p_embedding) AS similarity
  FROM chunks c
  WHERE c.user_id = p_user_id
    AND (p_exclude_item IS NULL OR c.item_id <> p_exclude_item)
  ORDER BY c.embedding <=> p_embedding
  LIMIT p_match_count;
$$;

-- Profile: nearest existing topic for a tag (caller applies the 0.8 cutoff).
CREATE OR REPLACE FUNCTION match_topic(
  p_user_id   uuid,
  p_embedding extensions.vector(768)
)
RETURNS TABLE (id uuid, name text, similarity float)
LANGUAGE sql STABLE
SET search_path = public, extensions
AS $$
  SELECT t.id, t.name, 1 - (t.embedding <=> p_embedding) AS similarity
  FROM topics t
  WHERE t.user_id = p_user_id AND t.embedding IS NOT NULL
  ORDER BY t.embedding <=> p_embedding
  LIMIT 1;
$$;

-- Profile: atomic weight change (+1 save, +2 thumbs-up, −2 thumbs-down, …).
CREATE OR REPLACE FUNCTION adjust_topic_weight(p_topic_id uuid, p_delta real)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE topics
  SET weight = weight + p_delta,
      last_seen_at = CASE WHEN p_delta > 0 THEN now() ELSE last_seen_at END
  WHERE id = p_topic_id;
$$;

-- Profile: weights fade 10% a week so old interests drop off.
CREATE OR REPLACE FUNCTION decay_topic_weights()
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE topics SET weight = weight * 0.9 WHERE weight <> 0;
$$;

REVOKE EXECUTE ON FUNCTION match_chunks(uuid, extensions.vector, int, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION match_topic(uuid, extensions.vector)             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION adjust_topic_weight(uuid, real)                  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION decay_topic_weights()                            FROM PUBLIC, anon, authenticated;

-- Monday 00:00 SAST (Sunday 22:00 UTC), after the Sunday-evening digest.
SELECT cron.schedule('decay-topic-weights', '0 22 * * 0', $$SELECT public.decay_topic_weights()$$);
