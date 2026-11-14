-- Recipes you come back to (docs/recipes.md): a "Want to cook" list and a log of
-- the times you cooked something, with a rating and a note for next time.
-- Additive: one new column and one new table.

-- When the recipe was put on the Want to cook list; NULL = not on it.
ALTER TABLE items ADD COLUMN IF NOT EXISTS cook_list_at timestamptz;

CREATE TABLE IF NOT EXISTS cooks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id     uuid        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  rating      smallint    CHECK (rating BETWEEN 1 AND 5),          -- NULL = not rated
  note        text        CHECK (char_length(note) <= 500),        -- "less salt next time"
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cooks_user_item_idx ON cooks (user_id, item_id, created_at);

ALTER TABLE cooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_cooks" ON cooks FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_allowlisted())
  WITH CHECK (auth.uid() = user_id AND public.is_allowlisted());
