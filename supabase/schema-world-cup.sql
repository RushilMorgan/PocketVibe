-- ─────────────────────────────────────────────────────────────────────────────
-- PocketVibe — World Cup 2026 global canonical tables
-- Run ONCE in: Supabase Dashboard → SQL Editor → New Query
-- Requires the base schema (schema.sql) to have been applied first.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── world_cup_teams ───────────────────────────────────────────────────────────
-- One row per national team.  provider_team_id comes from API-Football.
-- stage tracks the furthest round the team has reached so far.

CREATE TABLE IF NOT EXISTS world_cup_teams (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_team_id integer     UNIQUE NOT NULL,
  name             text        NOT NULL,
  code             text,                          -- 3-letter code, e.g. "BRA"
  country          text,
  flag_url         text,
  group_name       text,                          -- "A" … "P" (WC 2026 has 16 groups)
  stage            text        NOT NULL DEFAULT 'active',
  -- active | round_of_32 | round_of_16 | quarter_final | semi_final | final | winner | eliminated
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wc_teams_provider_idx ON world_cup_teams (provider_team_id);

-- Add pot and FIFA ranking columns (safe to run multiple times).
-- pot: draw pot (1–4); populated by sync function once official draw groups are known.
-- fifa_rank: FIFA ranking at time of draw; informational only.
ALTER TABLE world_cup_teams ADD COLUMN IF NOT EXISTS pot integer;
ALTER TABLE world_cup_teams ADD COLUMN IF NOT EXISTS fifa_rank integer;
CREATE INDEX IF NOT EXISTS wc_teams_pot_idx ON world_cup_teams (pot);

-- ── world_cup_matches ─────────────────────────────────────────────────────────
-- One row per fixture.  Scores are null until the match is finished.
-- is_manual_override marks admin-corrected scores (provider data will not
-- overwrite these rows during subsequent syncs).

CREATE TABLE IF NOT EXISTS world_cup_matches (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_match_id  integer     UNIQUE NOT NULL,
  home_team_id       integer     NOT NULL,   -- world_cup_teams.provider_team_id
  away_team_id       integer     NOT NULL,
  score_home         integer,                -- null until status = finished/live
  score_away         integer,
  match_date         timestamptz,
  stage              text,                   -- group | round_of_32 | round_of_16 | quarter_final | semi_final | final
  round              text,                   -- raw round string from provider, e.g. "Group Stage - 1"
  status             text        NOT NULL DEFAULT 'scheduled',
  -- scheduled | live | finished | postponed | cancelled
  venue              text,
  is_manual_override boolean     NOT NULL DEFAULT false,
  override_note      text,
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wc_matches_provider_idx   ON world_cup_matches (provider_match_id);
CREATE INDEX IF NOT EXISTS wc_matches_home_idx        ON world_cup_matches (home_team_id);
CREATE INDEX IF NOT EXISTS wc_matches_away_idx        ON world_cup_matches (away_team_id);
CREATE INDEX IF NOT EXISTS wc_matches_status_idx      ON world_cup_matches (status);

-- ── world_cup_sync_log ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS world_cup_sync_log (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  synced_at        timestamptz DEFAULT now(),
  status           text        NOT NULL,     -- success | partial | failed
  matches_upserted integer     DEFAULT 0,
  teams_upserted   integer     DEFAULT 0,
  error_message    text,
  provider         text        DEFAULT 'api-football',
  duration_ms      integer
);

-- ── Row-level security ────────────────────────────────────────────────────────
-- Teams and matches are public-read (anonymous can load them to build leaderboards).
-- All writes go through Edge Functions with the service role key.

ALTER TABLE world_cup_teams   ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_cup_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_cup_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_read_wc_teams"
  ON world_cup_teams FOR SELECT USING (true);

CREATE POLICY "anon_read_wc_matches"
  ON world_cup_matches FOR SELECT USING (true);

CREATE POLICY "no_anon_read_sync_log"
  ON world_cup_sync_log FOR SELECT USING (false);

-- ── Cron setup ────────────────────────────────────────────────────────────────
-- Requires pg_cron + pg_net extensions (enabled in Supabase Dashboard →
-- Database → Extensions).
--
-- Replace YOUR_SERVICE_ROLE_KEY with your project's service role key.
-- Replace the project ref in the URL if needed.
--
-- DAILY sync (off-season / pre-tournament — low frequency):
--
-- SELECT cron.schedule(
--   'sync-wc-results-daily',
--   '0 7 * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://trxmbkkxfafrommyhwkl.supabase.co/functions/v1/sync-world-cup-results',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );
--
-- MATCH-DAY sync (every 10 minutes during WC 2026 — June 11 to July 19 2026):
--
-- SELECT cron.schedule(
--   'sync-wc-results-match-day',
--   '*/10 * * * *',
--   $$
--   SELECT net.http_post(
--     url := 'https://trxmbkkxfafrommyhwkl.supabase.co/functions/v1/sync-world-cup-results',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );
--
-- Remove or disable the daily job once match-day job is active:
-- SELECT cron.unschedule('sync-wc-results-daily');
