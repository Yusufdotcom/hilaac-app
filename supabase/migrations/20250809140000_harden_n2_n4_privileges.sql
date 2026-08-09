-- Harden N2/N4: table-level GRANT UPDATE re-expanded to all columns, so column REVOKE
-- was ineffective in practice. Rebuild UPDATE as an allow-list. Also REVOKE demo RPC from PUBLIC.

-- N2: remove broad UPDATE, re-grant only non-secret / non-billing columns.
REVOKE UPDATE ON public.restaurants FROM authenticated, anon;

GRANT UPDATE (
  name,
  slug,
  previous_slug,
  branch_name,
  logo_url,
  address,
  phone,
  takeaway_hotline,
  payment_mode,
  evc_ussd_code,
  edahab_ussd_code,
  dine_in_enabled,
  takeaway_enabled,
  brand_color,
  custom_branding_enabled,
  is_active,
  is_demo,
  demo_expires_at
) ON public.restaurants TO authenticated;

-- Ensure sensitive columns stay service_role-only for writes.
REVOKE UPDATE (
  subscription_tier,
  subscription_status,
  subscription_end_date,
  evc_merchant_id_encrypted,
  evc_api_key_encrypted,
  edahab_merchant_id_encrypted,
  edahab_api_key_encrypted,
  owner_id
) ON public.restaurants FROM authenticated, anon;

REVOKE INSERT (
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
  edahab_api_key_encrypted,
  owner_id
) ON public.restaurants TO service_role;

-- N4: PUBLIC retain EXECUTE after role revoke — kill PUBLIC too.
REVOKE ALL ON FUNCTION public.create_demo_restaurant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_demo_restaurant() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_demo_restaurant() TO service_role;
