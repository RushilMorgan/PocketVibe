-- Running a save by the Council (docs/council.md): a session can be about one of your saves.
-- Additive: one nullable column and an index. Deleting the save keeps the session.
ALTER TABLE council_sessions ADD COLUMN IF NOT EXISTS item_id uuid REFERENCES items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS council_sessions_item_idx ON council_sessions (user_id, item_id) WHERE item_id IS NOT NULL;
