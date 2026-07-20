ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS custom_branding_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.restaurants.custom_branding_enabled IS 'Pro only: apply brand_color to the customer ordering menu';
