-- Admin order actions: cancelled status + audit log (loyalty-style actor attribution).

ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'cancelled';

CREATE TABLE IF NOT EXISTS public.order_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders (id) ON DELETE CASCADE,
  action text NOT NULL
    CHECK (action IN ('confirm_payment', 'cancel', 'update_status')),
  reason text,
  actor_id uuid NOT NULL REFERENCES public.profiles (id),
  previous_status text,
  new_status text,
  previous_payment_status text,
  new_payment_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_action_log_order_id_idx
  ON public.order_action_log (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS order_action_log_restaurant_id_idx
  ON public.order_action_log (restaurant_id, created_at DESC);

ALTER TABLE public.order_action_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff can view own restaurant order actions" ON public.order_action_log;
CREATE POLICY "staff can view own restaurant order actions"
  ON public.order_action_log
  FOR SELECT
  TO authenticated
  USING (restaurant_id = public.get_my_restaurant_id());

-- Inserts go through service-role API (requireActiveStaff + createAdminClient).
GRANT SELECT ON public.order_action_log TO authenticated;
GRANT ALL ON public.order_action_log TO service_role;

COMMENT ON TABLE public.order_action_log IS
  'Audit trail for confirm payment / cancel / manual status — actor + optional reason.';
