-- ─────────────────────────────────────────────────────────────────────────────
-- Saves feed redesign, Phase 7 (docs/saves-redesign.md B3): bringing old saves
-- back. One row per time you rate yourself on a recall card ("What were the key
-- ideas?") or a Then-and-now card (how this save connects to a related one).
-- The schedule (3 → 10 → 30 days) is worked out from these rows in
-- lib/reviews/schedule.ts; nothing else is stored.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id     uuid        NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  format      text        NOT NULL CHECK (format IN ('recall', 'connect')),
  rating      text        NOT NULL CHECK (rating IN ('got', 'fuzzy', 'forgot')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_user_item_idx ON reviews (user_id, item_id, created_at);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_reviews" ON reviews FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_allowlisted())
  WITH CHECK (auth.uid() = user_id AND public.is_allowlisted());
