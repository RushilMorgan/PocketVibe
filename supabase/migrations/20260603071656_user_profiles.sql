-- ─────────────────────────────────────────────────────────────────────────────
-- Hey Toolie — user profiles ("Toolie memory")
-- Stores a personalisation profile per signed-in user. The edge function reads
-- this and injects it (≤150 tokens) into the system prompt so Toolie already
-- knows the user before they say a word.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id        uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name           text,
  location       text,
  what_they_do   text,
  goals          text,
  preferences    text,
  remember_notes text,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read and write their own profile row.
CREATE POLICY "users_own_profile"
  ON user_profiles
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
