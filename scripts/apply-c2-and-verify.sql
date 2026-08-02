-- C2 apply + verify (run via: npx supabase db query --linked -f scripts/apply-c2-and-verify.sql)

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

SELECT
  has_column_privilege('authenticated', 'public.restaurants', 'evc_api_key_encrypted', 'SELECT') AS auth_select_evc_key,
  has_column_privilege('authenticated', 'public.restaurants', 'evc_merchant_id_encrypted', 'SELECT') AS auth_select_evc_mid,
  has_column_privilege('anon', 'public.restaurants', 'evc_api_key_encrypted', 'SELECT') AS anon_select_evc_key,
  has_column_privilege('service_role', 'public.restaurants', 'evc_api_key_encrypted', 'SELECT') AS service_select_evc_key;

SELECT grantee, privilege_type, column_name
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'restaurants'
  AND column_name LIKE '%encrypted%'
  AND grantee IN ('authenticated', 'anon', 'service_role')
ORDER BY grantee, column_name, privilege_type;
