-- N4: Demo RPC must not be callable by anon/authenticated clients.
-- Demo provisioning goes through /api/demo/create (gated + rate-limited) with service_role.

REVOKE EXECUTE ON FUNCTION public.create_demo_restaurant() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_demo_restaurant() TO service_role;
