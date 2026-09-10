-- Platform Open: allow is_platform_admin to pass restaurant-scoped RPC + orders RLS
-- without binding profiles.restaurant_id (dedicated platform accounts stay tenant-less).

CREATE OR REPLACE FUNCTION public.assert_restaurant_scope(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Platform Super Admin may access any tenant (support Open). Role check still applies.
  IF public.is_platform_admin() THEN
    RETURN;
  END IF;

  IF public.get_my_restaurant_id() IS NULL
     OR public.get_my_restaurant_id() IS DISTINCT FROM p_restaurant_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.assert_restaurant_scope(uuid) IS
  'Tenant scope for RPCs. Platform admins bypass restaurant_id match; others must match get_my_restaurant_id().';

GRANT EXECUTE ON FUNCTION public.assert_restaurant_scope(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.assert_reports_access(p_restaurant_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_restaurant_scope(p_restaurant_id);
  IF NOT public.is_manager_or_owner() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_orders_today(p_restaurant_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_count bigint;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  PERFORM public.assert_restaurant_scope(p_restaurant_id);

  IF NOT public.is_manager_or_owner() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT day_start, day_end INTO v_start, v_end FROM public.app_today_bounds();

  SELECT count(o.id)
  INTO order_count
  FROM public.orders o
  WHERE o.restaurant_id = p_restaurant_id
    AND o.created_at >= v_start
    AND o.created_at < v_end
    AND o.payment_status = 'paid';

  RETURN coalesce(order_count, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_revenue_today(p_restaurant_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_revenue numeric;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  PERFORM public.assert_restaurant_scope(p_restaurant_id);

  IF NOT public.is_manager_or_owner() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT day_start, day_end INTO v_start, v_end FROM public.app_today_bounds();

  SELECT coalesce(sum(o.total), 0)
  INTO total_revenue
  FROM public.orders o
  WHERE o.restaurant_id = p_restaurant_id
    AND o.created_at >= v_start
    AND o.created_at < v_end
    AND o.payment_status = 'paid';

  RETURN total_revenue;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_orders_today(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_dashboard_revenue_today(uuid) TO authenticated;

-- Orders / order_items: platform admin may SELECT/UPDATE the Open'd tenant rows.
DROP POLICY IF EXISTS "staff can view own restaurant orders" ON public.orders;
CREATE POLICY "staff can view own restaurant orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    restaurant_id = public.get_my_restaurant_id()
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "staff can update own restaurant orders" ON public.orders;
CREATE POLICY "staff can update own restaurant orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    restaurant_id = public.get_my_restaurant_id()
    OR public.is_platform_admin()
  )
  WITH CHECK (
    restaurant_id = public.get_my_restaurant_id()
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "staff can view own order_items" ON public.order_items;
CREATE POLICY "staff can view own order_items"
  ON public.order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_id
        AND (
          o.restaurant_id = public.get_my_restaurant_id()
          OR public.is_platform_admin()
        )
    )
  );

-- Durable audit log for platform Open / support access.
CREATE TABLE IF NOT EXISTS public.platform_support_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  restaurant_slug text NOT NULL,
  restaurant_name text,
  owner_id uuid,
  cross_tenant boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_support_audit_created
  ON public.platform_support_audit (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_support_audit_restaurant
  ON public.platform_support_audit (restaurant_id, created_at DESC);

ALTER TABLE public.platform_support_audit ENABLE ROW LEVEL SECURITY;

-- No authenticated policies — service_role only (written after requirePlatformAdmin).
REVOKE ALL ON public.platform_support_audit FROM anon, authenticated;
GRANT ALL ON public.platform_support_audit TO service_role;
