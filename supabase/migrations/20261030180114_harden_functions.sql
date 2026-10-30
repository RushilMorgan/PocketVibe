-- Advisor fixes after the reboot migration.
-- set_updated_at: pin search_path (folded into the reboot file for fresh installs).
-- claim_creation: old-site SECURITY DEFINER RPC the new app never calls; stop
-- exposing it to anon/authenticated via /rest/v1/rpc.
ALTER FUNCTION public.set_updated_at() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.claim_creation(text, text) FROM PUBLIC, anon, authenticated;
