-- C2: Encrypted merchant credentials must not be SELECT-able by authenticated
-- clients. Public restaurant SELECT (is_active = true) previously combined with
-- column grants to expose ciphertext cross-tenant.
--
-- Reads/writes of these columns go through service role only
-- (POST /api/payments/charge, PATCH /api/admin/restaurant/settings).

-- REVOKE ALL column privileges (SELECT/UPDATE/INSERT) so table-level
-- UPDATE/INSERT grants cannot keep ciphertext readable/writable via client roles.
REVOKE ALL (
  evc_merchant_id_encrypted,
  evc_api_key_encrypted,
  edahab_merchant_id_encrypted,
  edahab_api_key_encrypted
) ON public.restaurants FROM authenticated, anon;

GRANT SELECT (
  evc_merchant_id_encrypted,
  evc_api_key_encrypted,
  edahab_merchant_id_encrypted,
  edahab_api_key_encrypted
) ON public.restaurants TO service_role;

GRANT UPDATE (
  evc_merchant_id_encrypted,
  evc_api_key_encrypted,
  edahab_merchant_id_encrypted,
  edahab_api_key_encrypted
) ON public.restaurants TO service_role;
