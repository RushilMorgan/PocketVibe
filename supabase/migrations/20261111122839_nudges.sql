-- ─────────────────────────────────────────────────────────────────────────────
-- Saves feed redesign, Phase 4 (docs/saves-redesign.md B0): every push except
-- the weekly digest gets a row, so reminders can be capped and we can see
-- which kinds actually get tapped.
--   ready    the "your explainer is ready" push (always sent)
--   lesson / review / midweek / streak   reminders, one per chosen slot
-- `slot` ('2026-11-11T18:00', SAST) is set for reminders and unique per user,
-- so a slot can never be sent twice even if a job step re-runs.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS nudges (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id    uuid        REFERENCES items(id) ON DELETE CASCADE,
  kind       text        NOT NULL CHECK (kind IN ('ready', 'lesson', 'review', 'midweek', 'streak')),
  slot       text,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  tapped_at  timestamptz,
  action     text        CHECK (action IN ('open', 'read', 'play')),
  UNIQUE (user_id, slot)
);

CREATE INDEX IF NOT EXISTS nudges_user_sent_idx ON nudges (user_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS nudges_item_idx ON nudges (item_id, kind);

ALTER TABLE nudges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_nudges" ON nudges FOR ALL TO authenticated
  USING (auth.uid() = user_id AND public.is_allowlisted())
  WITH CHECK (auth.uid() = user_id AND public.is_allowlisted());
