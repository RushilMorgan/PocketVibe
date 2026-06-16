-- ─────────────────────────────────────────────────────────────────────────────
-- Hey Toolie — background generation jobs
-- A generic job row so a tool's generation can run server-side (detached from
-- the browser tab) and the client can collect the result on return + be pushed
-- a notification when it finishes. Recipe extraction is the first `kind`; other
-- tools reuse the same table by passing their own kind + request payload.
--
-- All access is via edge functions using the service role:
--   start-generation-job  — inserts a row, runs the pipeline in the background
--   get-generation-job    — returns status/result by id + client_token
-- so RLS is enabled with NO policies (direct anon/authenticated access denied).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS generation_jobs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind         text        NOT NULL,                 -- e.g. 'recipe'
  user_id      uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  client_token text        NOT NULL,                 -- unguessable; lets anon owners fetch their own result
  status       text        NOT NULL DEFAULT 'running'
                           CHECK (status IN ('running', 'done', 'error')),
  input        jsonb       NOT NULL,                 -- the GenerateRequest sent to the pipeline
  result       jsonb,                                -- the GenerateResponse when done
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS generation_jobs_user_id_idx ON generation_jobs (user_id);
CREATE INDEX IF NOT EXISTS generation_jobs_created_at_idx ON generation_jobs (created_at);

ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: the edge functions use the service role, which
-- bypasses RLS. Browser clients never touch this table directly.
