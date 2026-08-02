-- H4: profiles.is_active + RLS helpers refuse inactive staff.
-- Auth ban/unban is applied by the app Admin API (not this migration).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.is_active IS
  'When false, staff is deactivated. App should ban the auth user; middleware + RLS block existing JWTs.';

-- Cascade: restaurant-scoped RLS using this helper refuses inactive users.
CREATE OR REPLACE FUNCTION public.get_my_restaurant_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT restaurant_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active = true;
$$;

-- Users must not re-activate themselves via self-update.
DROP POLICY IF EXISTS "user can update own profile" ON public.profiles;
CREATE POLICY "user can update own profile" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid() AND is_active = true)
  WITH CHECK (id = auth.uid() AND is_active = true);

-- Owner/manager may update staff in their restaurant, but never owner-role rows
-- and never their own row via this policy (self-update uses the policy above).
DROP POLICY IF EXISTS "owner/manager can update staff" ON public.profiles;
CREATE POLICY "owner/manager can update staff" ON public.profiles
  FOR UPDATE
  USING (
    restaurant_id = public.get_my_restaurant_id()
    AND public.is_manager_or_owner()
    AND role <> 'owner'
    AND id <> auth.uid()
  )
  WITH CHECK (
    restaurant_id = public.get_my_restaurant_id()
    AND role <> 'owner'
  );

DROP POLICY IF EXISTS "owner/manager can remove staff" ON public.profiles;
CREATE POLICY "owner/manager can remove staff" ON public.profiles
  FOR DELETE
  USING (
    restaurant_id = public.get_my_restaurant_id()
    AND public.is_manager_or_owner()
    AND role <> 'owner'
    AND id <> auth.uid()
  );
