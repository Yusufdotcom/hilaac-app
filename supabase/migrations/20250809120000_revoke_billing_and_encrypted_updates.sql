-- N1/N2: Prevent authenticated clients from writing billing or encrypted merchant columns.
-- Subscription upgrades and credential writes must go through service_role (Admin API).

REVOKE UPDATE (
  subscription_tier,
  subscription_status,
  subscription_end_date,
  evc_merchant_id_encrypted,
  evc_api_key_encrypted,
  edahab_merchant_id_encrypted,
  edahab_api_key_encrypted
) ON public.restaurants FROM authenticated, anon;

GRANT UPDATE (
  subscription_tier,
  subscription_status,
  subscription_end_date,
  evc_merchant_id_encrypted,
  evc_api_key_encrypted,
  edahab_merchant_id_encrypted,
  edahab_api_key_encrypted
) ON public.restaurants TO service_role;
