-- Harden RPC grants for sensitive account/retention functions

REVOKE EXECUTE ON FUNCTION public.request_account_deletion(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_account_deletion(text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.process_due_account_deletions(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_due_account_deletions(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.delete_user_completely(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_completely(uuid) TO authenticated, service_role;
