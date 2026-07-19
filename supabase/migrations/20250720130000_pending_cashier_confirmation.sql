-- Cashier must verify every payment before it is recorded as paid.
ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'pending_cashier_confirmation';

-- Ensure restaurants.payment_mode exists (enum in production; safe no-op if present).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'restaurants'
      AND column_name = 'payment_mode'
  ) THEN
    ALTER TABLE public.restaurants
      ADD COLUMN payment_mode text NOT NULL DEFAULT 'ussd'
      CHECK (payment_mode IN ('ussd', 'api'));
  END IF;
END $$;

-- Customers must never mark orders as paid directly.
DROP POLICY IF EXISTS "customers can confirm payment on recent orders" ON public.orders;
REVOKE UPDATE (payment_status) ON public.orders FROM anon;
