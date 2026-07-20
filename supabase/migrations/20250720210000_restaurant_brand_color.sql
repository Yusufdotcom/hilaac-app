ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS brand_color text DEFAULT '#0F172A';

COMMENT ON COLUMN public.restaurants.brand_color IS 'Primary brand color for admin/staff sidebar and accents';
