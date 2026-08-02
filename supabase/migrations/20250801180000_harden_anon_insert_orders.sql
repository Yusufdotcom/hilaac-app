-- H1: anon INSERT on orders must bind to a real active restaurant, and if a
-- table_id is supplied it must belong to that same restaurant.
-- Menu items are not insertable by anon (order_items revoked) — validated in
-- POST /api/orders (service role) instead.

DROP POLICY IF EXISTS "anon_can_insert_orders" ON public.orders;

CREATE POLICY "anon_can_insert_orders"
  ON public.orders
  FOR INSERT
  TO anon
  WITH CHECK (
    auth.role() = 'anon'
    AND EXISTS (
      SELECT 1
      FROM public.restaurants r
      WHERE r.id = orders.restaurant_id
        AND r.is_active = true
    )
    AND (
      orders.table_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.tables t
        WHERE t.id = orders.table_id
          AND t.restaurant_id = orders.restaurant_id
          AND t.is_active = true
      )
    )
  );

GRANT INSERT ON public.orders TO anon;
