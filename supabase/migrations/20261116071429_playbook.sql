-- Playbook (docs/playbook.md): the frameworks pulled out of saves, kept in one place, and ideas
-- worked through them. Additive: three new tables, nothing existing is touched.

CREATE TABLE IF NOT EXISTS frameworks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  -- The name normalised (lib/playbook/shape.ts nameKey), so a framework met in a second save
  -- is linked to it rather than added twice.
  name_key    text        NOT NULL CHECK (char_length(name_key) BETWEEN 1 AND 80),
  content     jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name_key)
);

CREATE INDEX IF NOT EXISTS frameworks_user_idx ON frameworks (user_id, created_at DESC);

-- Which saves a framework came from. Deleting a save drops its links; the framework stays.
CREATE TABLE IF NOT EXISTS framework_items (
  framework_id uuid        NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
  item_id      uuid        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (framework_id, item_id)
);

CREATE INDEX IF NOT EXISTS framework_items_item_idx ON framework_items (user_id, item_id);

-- An idea worked through up to three frameworks. Each lens keeps the framework's name, so the
-- run still reads after a framework is removed.
CREATE TABLE IF NOT EXISTS playbook_runs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idea        text        NOT NULL CHECK (char_length(idea) <= 4000),
  content     jsonb       NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS playbook_runs_user_idx ON playbook_runs (user_id, created_at DESC);

ALTER TABLE frameworks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_frameworks" ON frameworks FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_allowlisted())
  WITH CHECK (auth.uid() = user_id AND public.is_allowlisted());

ALTER TABLE framework_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_framework_items" ON framework_items FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_allowlisted())
  WITH CHECK (auth.uid() = user_id AND public.is_allowlisted());

ALTER TABLE playbook_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_playbook_runs" ON playbook_runs FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_allowlisted())
  WITH CHECK (auth.uid() = user_id AND public.is_allowlisted());
