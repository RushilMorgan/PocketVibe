-- ─────────────────────────────────────────────────────────────────────────────
-- Hey Toolie — refund a daily-usage unit on failed generation
-- Quota is charged atomically BEFORE the pipeline runs (see increment_daily_usage),
-- which means a failed extraction would otherwise cost the user one of their
-- limited daily generations. This lets the Edge Function hand that unit back when
-- the pipeline returns a non-200, so only successful generations count (and the
-- recipe auto-retry doesn't multiply the charge).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refund_daily_usage(
  p_identifier text,
  p_kind       text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'utc')::date;
BEGIN
  UPDATE daily_usage
  SET count = GREATEST(0, count - 1), updated_at = now()
  WHERE identifier = p_identifier
    AND usage_date = v_today
    AND kind = p_kind;
END;
$$;
