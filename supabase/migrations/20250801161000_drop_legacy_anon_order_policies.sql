-- C1 follow-up: remote DB still had legacy policy names that recreate the
-- 7-day anon SELECT/UPDATE hole if SELECT/UPDATE is ever re-granted to anon.
-- Defense-in-depth: drop them. Customer status remains GET /api/orders/[id]/track.

DROP POLICY IF EXISTS "customers can track recent orders" ON public.orders;
DROP POLICY IF EXISTS "anon_can_view_order_status" ON public.orders;
DROP POLICY IF EXISTS "customer_can_confirm_payment" ON public.orders;
DROP POLICY IF EXISTS "customers can view recent order_items" ON public.order_items;
DROP POLICY IF EXISTS "customers can view recent order_items" ON public.order_items;

-- Ensure anon cannot SELECT/UPDATE orders or order_items (INSERT-only for orders).
REVOKE SELECT, UPDATE, DELETE ON public.orders FROM anon;
GRANT INSERT ON public.orders TO anon;
REVOKE ALL ON public.order_items FROM anon;

-- Authenticated must not rely on PUBLIC-role legacy policies alone; keep explicit staff policies.
-- Drop overly broad PUBLIC policies that duplicate staff access (is_staff / Anyone insert).
-- Keep anon_can_insert_orders + authenticated staff policies from prior migration.
DROP POLICY IF EXISTS "Anyone can insert orders" ON public.orders;
