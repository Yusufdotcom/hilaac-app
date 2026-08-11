-- Platform Super Admin: RLS helper + staff/manager bypass for support Open.
-- Does NOT grant is_platform_admin via app UI — flag remains service_role/SQL only.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT p.is_platform_admin
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
    ),
    false
  );
$$;

COMMENT ON FUNCTION public.is_platform_admin() IS
  'True when the JWT user has profiles.is_platform_admin. Used by RLS for support access.';

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.is_manager_or_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_my_role() IN ('owner', 'manager'), false)
         OR public.is_platform_admin();
$$;

CREATE OR REPLACE FUNCTION public.is_staff(restaurant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_platform_admin() THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.restaurant_id = $1
      AND profiles.id = auth.uid()
      AND profiles.is_active = true
      AND profiles.role IN ('owner', 'manager', 'waiter', 'kitchen', 'cashier')
  );
END;
$$;

-- Platform admin can SELECT any restaurant row (column grants still strip secrets).
DROP POLICY IF EXISTS "platform admin can view all restaurants" ON public.restaurants;
CREATE POLICY "platform admin can view all restaurants" ON public.restaurants
  FOR SELECT
  USING (public.is_platform_admin());

-- Platform admin can update non-secret restaurant fields during support Open.
DROP POLICY IF EXISTS "staff can update own restaurant" ON public.restaurants;
CREATE POLICY "staff can update own restaurant" ON public.restaurants
  FOR UPDATE
  USING (
    public.is_platform_admin()
    OR (id = public.get_my_restaurant_id() AND public.is_manager_or_owner())
  );
