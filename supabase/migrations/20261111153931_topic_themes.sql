-- Topics page revamp: the user's topics grouped into a few themes by the fast
-- model, cached until the set of topics changes (lib/topics.ts).
-- Shape: {"hash": "...", "themes": [{"name", "emoji", "topicIds": [...]}]}.
ALTER TABLE users ADD COLUMN IF NOT EXISTS topic_themes jsonb;
COMMENT ON COLUMN users.topic_themes IS 'Cached grouping of topics into themes for the Topics page; regenerated when the topic set changes.';
