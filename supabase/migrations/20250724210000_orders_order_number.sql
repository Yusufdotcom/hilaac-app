-- Ensure order_number exists for takeaway delivery codes on the customer status page.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_number integer;

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_order_number
  ON public.orders (restaurant_id, order_number DESC NULLS LAST);

COMMENT ON COLUMN public.orders.order_number IS
  'Human-friendly order / takeaway delivery code shown to customers (e.g. #217).';

-- Allow customer Realtime status page to read delivery code + billing fields.
GRANT SELECT (
  id, order_number, status, payment_status, order_type, billing_model,
  customer_confirmed_at, total, created_at, updated_at
) ON public.orders TO anon;
