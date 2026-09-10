-- Step 14 — Platform SOS exchange rate (additive).
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS usd_sos_rate numeric(12, 4) NOT NULL DEFAULT 571.00;

COMMENT ON COLUMN public.platform_settings.usd_sos_rate IS
  'How many SOS equal 1 USD. Used when restaurants.currency = SOS and restaurant.currency_rate is not set.';
