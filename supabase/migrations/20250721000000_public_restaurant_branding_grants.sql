-- Public customer order pages (anon) must read branding fields.
-- Column-level grants on restaurants are a whitelist; new columns are hidden until granted.

GRANT SELECT (brand_color, custom_branding_enabled) ON public.restaurants TO anon, authenticated;
