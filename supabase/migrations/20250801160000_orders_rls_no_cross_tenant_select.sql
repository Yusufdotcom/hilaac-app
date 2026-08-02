-- C1: Stop cross-tenant order leaks.
--
-- Before: anon + authenticated could SELECT any order from the last 7 days
-- (not bound to a known order id). Authenticated also had full-column GRANT,
-- so staff at restaurant A could read phones/notes from restaurant B.
--
-- After:
--   - Customers track a single order via GET /api/orders/[id]/track (service role).
--   - Anon has no SELECT on orders / order_items.
--   - Authenticated SELECT/UPDATE only via restaurant_id = get_my_restaurant_id().

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "customers can track recent orders" ON public.orders;

REVOKE ALL ON public.orders FROM anon;
-- Guest checkout may still INSERT via anon (server prefers service role).
GRANT INSERT ON public.orders TO anon;

DROP POLICY IF EXISTS "staff can view own restaurant orders" ON public.orders;
CREATE POLICY "staff can view own restaurant orders"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (restaurant_id = public.get_my_restaurant_id());

DROP POLICY IF EXISTS "staff can update own restaurant orders" ON public.orders;
CREATE POLICY "staff can update own restaurant orders"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

-- Keep table privileges for authenticated; RLS enforces tenant scope.
GRANT SELECT, UPDATE ON public.orders TO authenticated;

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "customers can view recent order_items" ON public.order_items;

REVOKE ALL ON public.order_items FROM anon;

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
        AND o.restaurant_id = public.get_my_restaurant_id()
    )
  );

GRANT SELECT ON public.order_items TO authenticated;
