-- Guest / Incognito status page + Realtime need SELECT on orders without auth.uid().
-- Policy is scoped to recent rows only (not a full table dump).

DROP POLICY IF EXISTS "customers can track recent orders" ON public.orders;
CREATE POLICY "customers can track recent orders"
  ON public.orders
  FOR SELECT
  TO anon, authenticated
  USING (created_at >= (now() - interval '7 days'));

-- Column grants for customer status + Realtime payloads (no phone/notes).
GRANT SELECT (
  id,
  order_number,
  status,
  payment_status,
  order_type,
  billing_model,
  customer_confirmed_at,
  total,
  created_at,
  updated_at
) ON public.orders TO anon;

-- Optional: allow anon to read line items for recent orders (confirmation UIs).
DROP POLICY IF EXISTS "customers can view recent order_items" ON public.order_items;
CREATE POLICY "customers can view recent order_items"
  ON public.order_items
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      WHERE o.id = order_id
        AND o.created_at >= (now() - interval '7 days')
    )
  );

GRANT SELECT (
  id,
  order_id,
  menu_item_id,
  quantity,
  add_ons,
  notes,
  price_at_time
) ON public.order_items TO anon;
