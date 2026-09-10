-- Step 9.3 — One-tap order ratings for Customer Intelligence feedback.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_rating smallint
    CHECK (customer_rating IS NULL OR (customer_rating >= 1 AND customer_rating <= 5));

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS customer_rated_at timestamptz;

COMMENT ON COLUMN public.orders.customer_rating IS
  'Guest 1–5 star rating after delivery (Customer Intelligence feedback).';
