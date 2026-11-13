-- ─────────────────────────────────────────────────────────────────────────────
-- AI usage tracking (docs/what-if.md, Part A). One row per Gemini or
-- OpenRouter call: what it was for, the tokens and searches it used, and the
-- estimated cost (lib/ai/pricing.ts; OpenRouter reports its own). cost_usd is
-- null when the model had no price yet — the tokens are kept so it can be
-- priced later. Written by the server (service role) only.
--
-- `feature` has no CHECK on purpose: new features log under new names without
-- a constraint change (the list lives in lib/ai/usage-summary.ts).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_usage (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id          uuid          REFERENCES items(id) ON DELETE SET NULL,
  feature          text          NOT NULL,
  provider         text          NOT NULL CHECK (provider IN ('gemini', 'openrouter')),
  model            text          NOT NULL,
  input_tokens     integer       NOT NULL DEFAULT 0,
  output_tokens    integer       NOT NULL DEFAULT 0,
  thinking_tokens  integer       NOT NULL DEFAULT 0,
  cached_tokens    integer       NOT NULL DEFAULT 0,
  search_queries   integer       NOT NULL DEFAULT 0,
  cost_usd         numeric(12,6),
  created_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_user_time_idx ON ai_usage (user_id, created_at);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_ai_usage" ON ai_usage FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.is_allowlisted());

-- The Settings card: totals per local month, feature and model since p_since.
CREATE OR REPLACE FUNCTION ai_usage_by_feature(p_user_id uuid, p_since timestamptz, p_tz text)
RETURNS TABLE (
  month text, feature text, provider text, model text, priced boolean, calls bigint,
  input_tokens bigint, output_tokens bigint, thinking_tokens bigint, cached_tokens bigint,
  search_queries bigint, cost_usd float8
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT to_char(u.created_at AT TIME ZONE p_tz, 'YYYY-MM'), u.feature, u.provider, u.model,
         u.cost_usd IS NOT NULL, count(*),
         sum(u.input_tokens), sum(u.output_tokens), sum(u.thinking_tokens), sum(u.cached_tokens),
         sum(u.search_queries), coalesce(sum(u.cost_usd), 0)::float8
  FROM ai_usage u
  WHERE u.user_id = p_user_id AND u.created_at >= p_since
  GROUP BY 1, 2, 3, 4, 5;
$$;

-- The Settings card: totals per save and model for one local month ('YYYY-MM').
CREATE OR REPLACE FUNCTION ai_usage_by_item(p_user_id uuid, p_since timestamptz, p_tz text, p_month text)
RETURNS TABLE (
  item_id uuid, provider text, model text, priced boolean, calls bigint,
  input_tokens bigint, output_tokens bigint, thinking_tokens bigint, cached_tokens bigint,
  search_queries bigint, cost_usd float8
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT u.item_id, u.provider, u.model, u.cost_usd IS NOT NULL, count(*),
         sum(u.input_tokens), sum(u.output_tokens), sum(u.thinking_tokens), sum(u.cached_tokens),
         sum(u.search_queries), coalesce(sum(u.cost_usd), 0)::float8
  FROM ai_usage u
  WHERE u.user_id = p_user_id AND u.created_at >= p_since AND u.item_id IS NOT NULL
    AND to_char(u.created_at AT TIME ZONE p_tz, 'YYYY-MM') = p_month
  GROUP BY 1, 2, 3, 4;
$$;

REVOKE EXECUTE ON FUNCTION ai_usage_by_feature(uuid, timestamptz, text)    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION ai_usage_by_item(uuid, timestamptz, text, text) FROM PUBLIC, anon, authenticated;
