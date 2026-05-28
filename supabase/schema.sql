-- ─────────────────────────────────────────────────────────────────────────────
-- PocketVibe — shared creations schema
-- Run once in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- ── shared_creations ─────────────────────────────────────────────────────────
-- Stores every shared tool. Raw admin tokens are NEVER stored; only the
-- SHA-256 hash is kept so the server can verify ownership without exposure.

CREATE TABLE IF NOT EXISTS shared_creations (
  id                        uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  share_slug                text        UNIQUE NOT NULL,
  title                     text        NOT NULL,
  creation_type             text        NOT NULL,
  content                   jsonb       NOT NULL DEFAULT '{}',
  owner_token_hash          text        NOT NULL,
  public_view               boolean     DEFAULT true,
  allow_participant_actions boolean     DEFAULT true,
  version                   integer     DEFAULT 1,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_creations_slug_idx
  ON shared_creations (share_slug);

-- ── shared_participants ───────────────────────────────────────────────────────
-- One row per participant link. participant_ref matches the id of the
-- participant inside the creation's content JSON.

CREATE TABLE IF NOT EXISTS shared_participants (
  id                     uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_creation_id     uuid        REFERENCES shared_creations(id) ON DELETE CASCADE,
  participant_ref        text        NOT NULL,
  display_name           text        NOT NULL,
  emoji                  text,
  participant_token_hash text,
  created_at             timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_participants_creation_idx
  ON shared_participants (shared_creation_id);

-- Ensure upsert on (creation, participant_ref) works correctly.
-- create-participant-link uses onConflict: 'shared_creation_id,participant_ref'
-- Note: ADD CONSTRAINT IF NOT EXISTS is not valid PostgreSQL syntax.
-- Use CREATE UNIQUE INDEX IF NOT EXISTS instead.
CREATE UNIQUE INDEX IF NOT EXISTS shared_participants_creation_ref_unique
  ON shared_participants (shared_creation_id, participant_ref);

-- ── shared_creation_events ────────────────────────────────────────────────────
-- Audit log of every write action performed through the API.

CREATE TABLE IF NOT EXISTS shared_creation_events (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_creation_id  uuid        REFERENCES shared_creations(id) ON DELETE CASCADE,
  actor_type          text,        -- 'admin' | 'participant' | 'viewer'
  actor_ref           text,        -- participantRef or 'admin'
  event_type          text,        -- 'create' | 'update' | 'participant_action'
  payload             jsonb,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shared_creation_events_creation_idx
  ON shared_creation_events (shared_creation_id);

-- ── Row-level security ────────────────────────────────────────────────────────
-- All writes go through Edge Functions using the service role key which
-- bypasses RLS. Public reads use the anon key governed by these policies.

ALTER TABLE shared_creations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_creation_events ENABLE ROW LEVEL SECURITY;

-- Anyone can read public shared creations (the edge function filters by
-- public_view before returning content to callers).
CREATE POLICY "anon_can_read_public"
  ON shared_creations FOR SELECT
  USING (public_view = true);

-- Participants are loaded by the edge function using the service role key.
-- No direct anon read needed.
CREATE POLICY "no_direct_anon_participant_read"
  ON shared_participants FOR SELECT
  USING (false);

CREATE POLICY "no_direct_anon_event_read"
  ON shared_creation_events FOR SELECT
  USING (false);

-- ── Auth: owner_user_id + claim function ──────────────────────────────────────
-- Requires pgcrypto for SHA-256 hashing in the claim function.
-- gen_random_uuid() already uses pgcrypto, so this is a no-op in most projects.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add owner_user_id to shared_creations (nullable; set when user registers/claims).
ALTER TABLE shared_creations
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add user_id to shared_participants (for future participant claiming).
ALTER TABLE shared_participants
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Authenticated users can read their own shared creations (My Tools page).
DROP POLICY IF EXISTS "owner_can_read_own" ON shared_creations;
CREATE POLICY "owner_can_read_own"
  ON shared_creations FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

-- ── claim_creation DB function ────────────────────────────────────────────────
-- Called from the client via supabase.rpc('claim_creation', ...) after the user
-- registers/signs in. Verifies the raw admin token by comparing its SHA-256 hash
-- to the stored owner_token_hash, then sets owner_user_id = auth.uid().
-- SECURITY DEFINER: runs with the privileges of the function owner so it can
-- write owner_user_id even though the row is owned by service role.
CREATE OR REPLACE FUNCTION claim_creation(p_share_slug TEXT, p_admin_token TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hash TEXT;
  v_id   UUID;
BEGIN
  v_hash := encode(digest(p_admin_token::bytea, 'sha256'), 'hex');
  UPDATE shared_creations
  SET    owner_user_id = auth.uid()
  WHERE  share_slug        = p_share_slug
    AND  owner_token_hash  = v_hash
    AND  (owner_user_id IS NULL OR owner_user_id = auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

