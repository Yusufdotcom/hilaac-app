-- Step 11 — Staff POS attribution (additive, nullable).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.orders.created_by IS
  'Profile id of the staff member who created a manual POS order. Null for guest QR orders.';

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_by
  ON public.orders (restaurant_id, created_by)
  WHERE created_by IS NOT NULL;
