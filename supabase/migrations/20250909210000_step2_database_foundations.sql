-- Step 2 — Database foundations (additive only).
-- Nullable / defaulted columns and new tables so live tenants are unaffected.
-- No UI or order/payment behavior changes in this migration.

-- 2.1 Cost price on menu items (nullable — fill when ready)
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS cost_price numeric(10, 2);

COMMENT ON COLUMN public.menu_items.cost_price IS
  'Ingredient / prep cost for margin math. Nullable until restaurant fills it in.';

-- 2.2 Expenses table (Galeyr P&L)
CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('rent', 'utilities', 'labor', 'supplies', 'other')),
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  date date NOT NULL,
  note text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_restaurant_date
  ON public.expenses (restaurant_id, date DESC);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_isolation" ON public.expenses;
CREATE POLICY "restaurant_isolation" ON public.expenses
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;

-- 2.3 Inventory items (Gorgor+)
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL,
  current_stock numeric(12, 3) NOT NULL DEFAULT 0,
  daily_usage_estimate numeric(12, 3),
  reorder_level numeric(12, 3),
  supplier_delivery_days integer NOT NULL DEFAULT 2,
  cost_per_unit numeric(12, 2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant
  ON public.inventory_items (restaurant_id);

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_isolation" ON public.inventory_items;
CREATE POLICY "restaurant_isolation" ON public.inventory_items
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;

COMMENT ON TABLE public.inventory_items IS
  'days_remaining = current_stock / NULLIF(daily_usage_estimate, 0) — compute at query time, do not store.';

-- 2.4 Customer profiles view (security_invoker so orders RLS applies)
CREATE OR REPLACE VIEW public.customer_profiles
WITH (security_invoker = true)
AS
SELECT
  restaurant_id,
  customer_phone,
  COUNT(*)::bigint AS total_visits,
  COALESCE(SUM(total), 0)::numeric AS lifetime_spend,
  MAX(created_at) AS last_visit,
  MIN(created_at) AS first_visit
FROM public.orders
WHERE customer_phone IS NOT NULL
  AND status <> 'cancelled'
GROUP BY restaurant_id, customer_phone;

GRANT SELECT ON public.customer_profiles TO authenticated;

COMMENT ON VIEW public.customer_profiles IS
  'Per-phone visit/spend rollup from orders. Invokes caller RLS on orders.';

-- 2.5 Multi-currency (SOS priority later; default USD keeps existing totals identical)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS currency_rate numeric(18, 8) NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.restaurants.currency IS
  'Display / settlement currency code. Default USD. SOS support lands in Step 14.';
COMMENT ON COLUMN public.restaurants.currency_rate IS
  'Multiply stored USD-normalized amounts by this rate for display when needed. Default 1.';

-- 2.6 Business type (retail-readiness; no behavior change yet)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'restaurant';

COMMENT ON COLUMN public.restaurants.business_type IS
  'Future expansion: restaurant (default) | retail. When business_type = retail, QR/table flow and kitchen roles will be reinterpreted — no retail UI yet (Step 16).';

-- 2.7 Staff hourly rate (labor cost)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10, 2);

COMMENT ON COLUMN public.profiles.hourly_rate IS
  'Optional hourly wage for labor cost / staff performance. Nullable until set.';
