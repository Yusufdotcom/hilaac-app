-- Platform Super Admin + subscription renewals (Hilaac SaaS billing).
-- is_platform_admin is orthogonal to restaurant user_role and frozen against JWT updates.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_platform_admin boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.is_platform_admin IS
  'Platform Super Admin. Set only via service_role / SQL. Never grantable by restaurant owners.';

-- Freeze is_platform_admin the same way as role / restaurant_id / is_active.
CREATE OR REPLACE FUNCTION public.profiles_prevent_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admin / service-role paths (no end-user JWT).
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Owner/manager updating another non-owner staff row in their restaurant.
  IF NEW.id IS DISTINCT FROM auth.uid()
     AND public.is_manager_or_owner()
     AND OLD.role IS DISTINCT FROM 'owner'
     AND NEW.role IS DISTINCT FROM 'owner'
     AND NEW.restaurant_id = public.get_my_restaurant_id()
     AND NEW.is_platform_admin IS NOT DISTINCT FROM OLD.is_platform_admin
  THEN
    RETURN NEW;
  END IF;

  -- Self-update (or any other path): freeze privileged columns.
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.restaurant_id IS DISTINCT FROM OLD.restaurant_id
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin
  THEN
    RAISE EXCEPTION 'Cannot change role, restaurant_id, is_active, or is_platform_admin on this profile'
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

-- Seed: Baba's Grill owner becomes platform admin (founder).
UPDATE public.profiles p
SET is_platform_admin = true
FROM public.restaurants r
WHERE r.slug = 'baba-s-grill-and-cafe'
  AND r.owner_id IS NOT NULL
  AND p.id = r.owner_id;

-- Platform merchant USSD (encrypted at rest; separate from restaurant customer codes).
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id integer PRIMARY KEY CHECK (id = 1),
  evc_ussd_code_encrypted text,
  edahab_ussd_code_encrypted text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL
);

INSERT INTO public.platform_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon — service_role only via Admin API after requirePlatformAdmin.

CREATE TYPE public.subscription_renewal_status AS ENUM (
  'pending_confirmation',
  'confirmed',
  'rejected'
);

CREATE TABLE IF NOT EXISTS public.subscription_renewals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tier public.subscription_tier NOT NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  method public.payment_method NOT NULL,
  status public.subscription_renewal_status NOT NULL DEFAULT 'pending_confirmation',
  tx_ref text,
  confirmed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscription_renewals_status_created_idx
  ON public.subscription_renewals (status, created_at DESC);

CREATE INDEX IF NOT EXISTS subscription_renewals_restaurant_idx
  ON public.subscription_renewals (restaurant_id, created_at DESC);

ALTER TABLE public.subscription_renewals ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon — service_role only via gated Admin APIs.
