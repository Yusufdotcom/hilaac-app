-- Step 8 — Recurring weekly staff shifts (additive).
CREATE TABLE IF NOT EXISTS public.staff_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants (id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  staff_name text NOT NULL,
  -- 0 = Monday … 6 = Sunday (matches admin schedule grid)
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT staff_shifts_time_order CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_restaurant_day
  ON public.staff_shifts (restaurant_id, day_of_week);

ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_isolation" ON public.staff_shifts;
CREATE POLICY "restaurant_isolation" ON public.staff_shifts
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_shifts TO authenticated;

COMMENT ON TABLE public.staff_shifts IS
  'Weekly recurring shift template for Staff Performance schedule grid (Step 8).';
