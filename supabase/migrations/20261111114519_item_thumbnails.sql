-- Saves feed redesign, Phase 1 (docs/saves-redesign.md A1): a thumbnail and
-- video length per item. Both nullable; the feed falls back to a kind tile.
ALTER TABLE items ADD COLUMN IF NOT EXISTS thumbnail_url text;
ALTER TABLE items ADD COLUMN IF NOT EXISTS duration_seconds integer;
COMMENT ON COLUMN items.thumbnail_url IS 'The source''s own preview image (YouTube i.ytimg.com, og:image, TikTok oEmbed); linked, not copied. null = none found.';
COMMENT ON COLUMN items.duration_seconds IS 'Video length read from the YouTube watch page; null for articles or when it could not be read.';
