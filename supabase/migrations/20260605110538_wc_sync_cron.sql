-- ─────────────────────────────────────────────────────────────────────────────
-- Hey Toolie — World Cup 2026 automatic result sync (Gemini-powered)
-- Schedules the sync-world-cup-results Edge Function to run every 6 hours
-- during the tournament window (June 11 – July 19 2026).
--
-- Requires: pg_cron and pg_net extensions (both enabled on Supabase Pro).
-- If not available, invoke the function manually or via GitHub Actions.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable pg_net if not already (needed to call HTTP endpoints from cron)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing schedule with this name before recreating
SELECT cron.unschedule('sync-wc-results') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'sync-wc-results'
);

-- Schedule: every 6 hours, June–July 2026
-- Adjust the URL to match your Supabase project reference.
-- The Authorization header uses the service role key stored as a DB setting.
SELECT cron.schedule(
  'sync-wc-results',
  '0 */6 * * *',   -- every 6 hours, on the hour
  $$
    SELECT net.http_post(
      url     := 'https://trxmbkkxfafrommyhwkl.supabase.co/functions/v1/sync-world-cup-results',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body    := '{"days_back": 1}'::jsonb
    ) AS request_id;
  $$
);
