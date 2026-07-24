-- Takeaway tracking hotline shown on the customer order status page.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS takeaway_hotline text;

COMMENT ON COLUMN public.restaurants.takeaway_hotline IS
  'Public phone number customers can call for takeaway order tracking.';

GRANT SELECT (takeaway_hotline) ON public.restaurants TO anon, authenticated;
