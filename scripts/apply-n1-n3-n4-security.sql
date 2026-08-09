-- Apply N1/N2 + N3 + N4 security close-outs (run in Supabase SQL editor if db push blocked).
-- Safe to re-run. Includes 20250809140000 harden: allow-list UPDATE + REVOKE demo FROM PUBLIC.

-- N2: table-level UPDATE expanded to all columns — rebuild as allow-list.
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

-- N3
CREATE OR REPLACE FUNCTION public.profiles_prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM auth.uid()
     AND public.is_manager_or_owner()
     AND OLD.role IS DISTINCT FROM 'owner'
     AND NEW.role IS DISTINCT FROM 'owner'
     AND NEW.restaurant_id = public.get_my_restaurant_id()
  THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
  THEN
    RAISE EXCEPTION 'Cannot change role, restaurant_id, or is_active on this profile'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_prevent_privilege_escalation();

-- N4 (PUBLIC often retains EXECUTE after role revoke)
REVOKE ALL ON FUNCTION public.create_demo_restaurant() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_demo_restaurant() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_demo_restaurant() TO service_role;
