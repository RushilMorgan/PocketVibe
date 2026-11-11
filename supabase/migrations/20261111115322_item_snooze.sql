-- Saves feed redesign, Phase 2 (docs/saves-redesign.md A3): "Not now" on the
-- Up next card hides an item from it for 3 days, synced across devices.
ALTER TABLE items ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;
COMMENT ON COLUMN items.snoozed_until IS 'Hidden from the feed''s Up next card until this time; null = not snoozed.';
