-- ─────────────────────────────────────────────────────────────────────────────
-- HeyToolie — lock the database to allowlisted users.
--
-- The app already rejects anyone not in allowed_emails, but RLS only checked
-- "your own rows", so a signed-in non-allowlisted account (e.g. one left over
-- from the old site) could still read/write its own rows through the public
-- Supabase API. Every HeyToolie policy now also requires is_allowlisted().
-- Server code uses the service role and is unaffected.
--
-- The old site's tables and functions lose all public/authenticated access.
-- No data is touched; GRANT restores access if ever needed.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_allowlisted()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM allowed_emails WHERE email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_allowlisted() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_allowlisted() TO authenticated;

-- ── HeyToolie tables: own rows AND allowlisted ───────────────────────────────
DROP POLICY IF EXISTS "own_user_row" ON users;
CREATE POLICY "own_user_row" ON users FOR ALL TO authenticated
  USING (auth.uid() = id AND public.is_allowlisted())
  WITH CHECK (auth.uid() = id AND public.is_allowlisted());

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT * FROM (VALUES
    ('push_devices', 'own_push_devices'),
    ('items', 'own_items'),
    ('item_outputs', 'own_item_outputs'),
    ('chunks', 'own_chunks'),
    ('topics', 'own_topics'),
    ('item_topics', 'own_item_topics'),
    ('events', 'own_events'),
    ('digests', 'own_digests'),
    ('chat_messages', 'own_chat_messages')
  ) AS v(tbl, pol)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t.pol, t.tbl);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated
         USING (auth.uid() = user_id AND public.is_allowlisted())
         WITH CHECK (auth.uid() = user_id AND public.is_allowlisted())',
      t.pol, t.tbl
    );
  END LOOP;
END $$;

-- Server-only tables: no API access at all (RLS already had no policies).
REVOKE ALL ON TABLE allowed_emails, public_tool_usage FROM anon, authenticated;

-- ── Old site: no public or signed-in access ──────────────────────────────────
REVOKE ALL ON TABLE
  daily_usage, generation_jobs, push_subscriptions, shared_creation_events, shared_creations,
  shared_participants, sites, user_creations, user_profiles, world_cup_matches,
  world_cup_sync_log, world_cup_teams
FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.increment_daily_usage(text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_daily_usage(text, text) FROM PUBLIC, anon, authenticated;
