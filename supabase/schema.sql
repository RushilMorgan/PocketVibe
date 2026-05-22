-- ─────────────────────────────────────────────────────────────────────────────
-- EverySite — sites table
-- Run this once in: Supabase Dashboard → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sites (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email         text        NOT NULL,
  business_name text        NOT NULL,
  subdomain     text        UNIQUE NOT NULL,
  config        jsonb       NOT NULL DEFAULT '{}',
  is_live       boolean     DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- Enable row-level security
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

-- Allow the public (unauthenticated) "claim" flow to insert rows
CREATE POLICY "public_can_insert"
  ON sites FOR INSERT
  WITH CHECK (true);

-- Authenticated users can read only their own sites
CREATE POLICY "owner_can_select"
  ON sites FOR SELECT
  USING (email = auth.jwt() ->> 'email');

-- Authenticated users can update only their own sites
CREATE POLICY "owner_can_update"
  ON sites FOR UPDATE
  USING (email = auth.jwt() ->> 'email');
