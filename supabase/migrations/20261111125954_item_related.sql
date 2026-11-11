-- Saves feed redesign, Phase 5 (docs/saves-redesign.md B4): the one earlier
-- save this item connects to most, if it's close enough (similarity ≥ 0.80,
-- measured on real saves 2026-11-11). Shape: {"itemId", "title", "similarity"}.
-- Set by the process-item job; null = nothing close enough.
ALTER TABLE items ADD COLUMN IF NOT EXISTS related jsonb;
COMMENT ON COLUMN items.related IS 'Closest other save above the 0.80 similarity bar: {itemId, title, similarity}; null = none. Set by the related job step.';
