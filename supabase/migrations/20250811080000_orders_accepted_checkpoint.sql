-- Staff acceptance checkpoint before kitchen cooks.
-- Independent of payment_status (required for pay_after restaurants).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by text;

COMMENT ON COLUMN public.orders.accepted_at IS
  'When a waiter/cashier confirmed a guest is present; kitchen only sees accepted orders.';
COMMENT ON COLUMN public.orders.accepted_by IS
  'Display name of the staff member who accepted the order (accountability).';

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_unaccepted
  ON public.orders (restaurant_id, created_at DESC)
  WHERE accepted_at IS NULL AND status = 'new';

CREATE INDEX IF NOT EXISTS idx_orders_restaurant_accepted_at
  ON public.orders (restaurant_id, accepted_at DESC NULLS LAST);
