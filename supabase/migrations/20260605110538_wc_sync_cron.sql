-- ─────────────────────────────────────────────────────────────────────────────
-- Hey Toolie — World Cup 2026 automatic result sync (Gemini-powered)
-- Schedules the sync-world-cup-results Edge Function to run every 6 hours
-- during the tournament window (June 11 – July 19 2026).
--
-- Requires: pg_cron and pg_net extensions (both enabled on Supabase Pro).
-- If not available, invoke the function manually or via GitHub Actions.
-- ─────────────────────────────────────────────────────────────────────────────

-- Cron scheduling for sync-world-cup-results is handled via the Supabase Dashboard.
-- pg_cron is not available on the free plan.
--
-- To set up the schedule:
--   1. Go to https://supabase.com/dashboard/project/trxmbkkxfafrommyhwkl/functions
--   2. Click sync-world-cup-results → Schedule
--   3. Set cron expression: 0 */6 * * *  (every 6 hours)
--   4. Set HTTP method: POST
--   5. Add header: x-sync-secret: heytoolie-wc-sync-2026
--   6. Set body: {"days_back":1}
--
-- Or invoke manually:
--   curl -X POST https://trxmbkkxfafrommyhwkl.supabase.co/functions/v1/sync-world-cup-results \
--     -H "x-sync-secret: heytoolie-wc-sync-2026" \
--     -H "Content-Type: application/json" \
--     -d '{"days_back":3}'

SELECT 1; -- no-op so migration applies cleanly
