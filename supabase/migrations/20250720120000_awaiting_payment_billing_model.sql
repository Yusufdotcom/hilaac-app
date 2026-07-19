-- Pay-before workflow: orders wait for cashier verification before kitchen sees them.
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'awaiting_payment';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS billing_model text
  CHECK (billing_model IS NULL OR billing_model IN ('pay_before', 'pay_after'));
