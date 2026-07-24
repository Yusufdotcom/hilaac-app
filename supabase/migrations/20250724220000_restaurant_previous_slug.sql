-- Keep old QR codes working after a restaurant rename by storing the prior slug.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS previous_slug text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_previous_slug
  ON public.restaurants (previous_slug)
  WHERE previous_slug IS NOT NULL;

COMMENT ON COLUMN public.restaurants.previous_slug IS
  'Prior slug after a rename — /order/[previous_slug] redirects to the current slug so printed QR codes keep working.';

GRANT SELECT (previous_slug) ON public.restaurants TO anon, authenticated;

-- Public ordering page also needs billing model columns when using the anon key.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'restaurants' AND column_name = 'billing_model_dinein'
  ) THEN
    EXECUTE 'GRANT SELECT (billing_model_dinein, billing_model_takeaway) ON public.restaurants TO anon, authenticated';
  END IF;
END $$;
