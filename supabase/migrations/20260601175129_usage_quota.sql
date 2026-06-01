-- ─────────────────────────────────────────────────────────────────────────────
-- Hey Toolie — usage quota schema
-- Run once in: Supabase Dashboard → SQL Editor → New Query
--
-- Tracks per-day AI usage so the pocketvibe-generate Edge Function can enforce
-- daily limits per signed-in user (identifier_type = 'user') or per IP for
-- anonymous traffic (identifier_type = 'ip'). All writes go through the Edge
-- Function using the service role key, which bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── daily_usage ───────────────────────────────────────────────────────────────
-- One row per (identifier, day, kind). `kind` is 'generation' (new/improve/add —
-- the expensive full pipeline) or 'chat' (the lighter Q&A path).

CREATE TABLE IF NOT EXISTS daily_usage (
  id              bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  identifier      text        NOT NULL,                       -- user UUID or 'ip:1.2.3.4'
  identifier_type text        NOT NULL,                       -- 'user' | 'ip'
  usage_date      date        NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  kind            text        NOT NULL,                       -- 'generation' | 'chat'
  count           integer     NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (identifier, usage_date, kind)
);

CREATE INDEX IF NOT EXISTS daily_usage_lookup_idx
  ON daily_usage (identifier, usage_date, kind);

-- Old rows are never read after their day passes. Optional cleanup (safe to skip):
--   DELETE FROM daily_usage WHERE usage_date < (now() AT TIME ZONE 'utc')::date - 7;

ALTER TABLE daily_usage ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: only the Edge Function (service role) touches this.

-- ── increment_daily_usage ─────────────────────────────────────────────────────
-- Atomically checks the current count for (identifier, today, kind) against
-- p_limit and increments ONLY when under the limit. Returns the decision plus
-- the resulting count. The row is locked FOR UPDATE so concurrent calls for the
-- same identifier serialise correctly (no double-spend, no over-count).

CREATE OR REPLACE FUNCTION increment_daily_usage(
  p_identifier      text,
  p_identifier_type text,
  p_kind            text,
  p_limit           integer
)
RETURNS TABLE (allowed boolean, used integer, limit_val integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
  v_count integer;
BEGIN
  -- Ensure the row exists, then lock it.
  INSERT INTO daily_usage (identifier, identifier_type, usage_date, kind, count)
  VALUES (p_identifier, p_identifier_type, v_today, p_kind, 0)
  ON CONFLICT (identifier, usage_date, kind) DO NOTHING;

  SELECT count INTO v_count
  FROM daily_usage
  WHERE identifier = p_identifier
    AND usage_date = v_today
    AND kind = p_kind
  FOR UPDATE;

  IF v_count >= p_limit THEN
    RETURN QUERY SELECT false, v_count, p_limit;
  ELSE
    UPDATE daily_usage
    SET count = count + 1, updated_at = now()
    WHERE identifier = p_identifier
      AND usage_date = v_today
      AND kind = p_kind;
    RETURN QUERY SELECT true, v_count + 1, p_limit;
  END IF;
END;
$$;
