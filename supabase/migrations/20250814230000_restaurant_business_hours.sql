-- Recap-only business hours. Null times/days = 24h calendar days (existing restaurants unchanged).
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS opening_time time,
  ADD COLUMN IF NOT EXISTS closing_time time,
  ADD COLUMN IF NOT EXISTS business_days smallint[];

COMMENT ON COLUMN public.restaurants.opening_time IS
  'Recap business-day start (local Africa/Nairobi). Null with closing_time null = 24-hour calendar day.';
COMMENT ON COLUMN public.restaurants.closing_time IS
  'Recap business-day end. May be earlier than opening_time (overnight, e.g. 02:00).';
COMMENT ON COLUMN public.restaurants.business_days IS
  'Days the restaurant is open for recaps: 0=Sunday … 6=Saturday. Null = every day.';
