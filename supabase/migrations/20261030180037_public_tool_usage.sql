-- ─────────────────────────────────────────────────────────────────────────────
-- HeyToolie — daily limit for the public (no-login) recipe extractor page.
-- Keyed by a salted hash of the visitor's IP, never the raw address.
-- Service role only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public_tool_usage (
  visitor  text NOT NULL,          -- sha256(ip + salt)
  tool     text NOT NULL,
  day      date NOT NULL,
  count    int  NOT NULL DEFAULT 0,
  PRIMARY KEY (visitor, tool, day)
);

ALTER TABLE public_tool_usage ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role touches it.

-- Atomically counts one use; returns false (and counts nothing) once the
-- visitor has hit p_limit for the day.
CREATE OR REPLACE FUNCTION take_public_tool_use(p_visitor text, p_tool text, p_day date, p_limit int)
RETURNS boolean
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  used int;
BEGIN
  INSERT INTO public_tool_usage AS u (visitor, tool, day, count)
  VALUES (p_visitor, p_tool, p_day, 1)
  ON CONFLICT (visitor, tool, day) DO UPDATE
    SET count = u.count + 1
    WHERE u.count < p_limit
  RETURNING count INTO used;
  RETURN used IS NOT NULL;
END;
$$;

-- Gives a use back when the extraction failed (not the visitor's fault).
CREATE OR REPLACE FUNCTION refund_public_tool_use(p_visitor text, p_tool text, p_day date)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE public_tool_usage SET count = greatest(count - 1, 0)
  WHERE visitor = p_visitor AND tool = p_tool AND day = p_day;
$$;

REVOKE EXECUTE ON FUNCTION take_public_tool_use(text, text, date, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION refund_public_tool_use(text, text, date)    FROM PUBLIC, anon, authenticated;
