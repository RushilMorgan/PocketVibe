-- ─────────────────────────────────────────────────────────────────────────────
-- What if… (docs/what-if.md, Part B). One row per scenario on a save: the
-- default one Flash picks when it classifies the save ('main', at most one per
-- save), the two suggested others and any you type ('alternative', 'custom').
-- `content` is the card (lib/whatif/schema.ts), written in two steps: Search
-- for today's facts, then the smart model. `opened_at` is the first time the
-- full card was opened — what "is anyone reading these?" is measured on.
--
-- A table of its own rather than item_outputs rows: several per save, a
-- pending/failed state, and no change to existing CHECK constraints.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS whatifs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id     uuid        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  scenario    text        NOT NULL,
  kind        text        NOT NULL CHECK (kind IN ('main', 'alternative', 'custom')),
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'failed')),
  content     jsonb,
  error       text,
  opened_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatifs_user_item_idx ON whatifs (user_id, item_id, created_at);
-- One default scenario per save, so a re-run job replaces it instead of adding another.
CREATE UNIQUE INDEX IF NOT EXISTS whatifs_one_main_idx ON whatifs (item_id) WHERE kind = 'main';

ALTER TABLE whatifs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_whatifs" ON whatifs FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_allowlisted())
  WITH CHECK (auth.uid() = user_id AND public.is_allowlisted());

CREATE TRIGGER whatifs_updated_at BEFORE UPDATE ON whatifs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
