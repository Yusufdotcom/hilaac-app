-- V3 Part 2 — Somali Airlines feature tables (additive only).
-- Uses existing get_my_restaurant_id() RLS pattern.
-- Does not alter orders/payments/middleware.

-- Season mode on restaurant (Ramadan / Eid / off)
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS active_season text
  CHECK (active_season IS NULL OR active_season IN ('ramadan', 'eid'));

COMMENT ON COLUMN public.restaurants.active_season IS
  'Somali Airlines: ramadan | eid | null (off). Only one season at a time.';

-- 2.1 Ramadan / Eid packages
CREATE TABLE IF NOT EXISTS public.ramadan_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('normal', 'buffet')),
  price numeric NOT NULL,
  description text,
  menu_items jsonb,
  buffet_start_time time,
  buffet_end_time time,
  max_daily_capacity integer,
  valid_from date NOT NULL,
  valid_to date NOT NULL,
  meal_type text CHECK (meal_type IS NULL OR meal_type IN ('iftar', 'suhoor', 'both')),
  season text NOT NULL CHECK (season IN ('ramadan', 'eid')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ramadan_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL REFERENCES public.ramadan_packages(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  pass_code text UNIQUE NOT NULL,
  payment_status text DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','refunded')),
  payment_amount numeric,
  gifted_by text,
  gifted_by_phone text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ramadan_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.ramadan_subscriptions(id) ON DELETE CASCADE,
  package_id uuid NOT NULL REFERENCES public.ramadan_packages(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  checkin_time timestamptz DEFAULT now(),
  confirmed_by uuid REFERENCES public.profiles(id),
  UNIQUE (subscription_id, checkin_date)
);

CREATE INDEX IF NOT EXISTS ramadan_packages_restaurant_idx
  ON public.ramadan_packages (restaurant_id);
CREATE INDEX IF NOT EXISTS ramadan_subscriptions_restaurant_idx
  ON public.ramadan_subscriptions (restaurant_id);
CREATE INDEX IF NOT EXISTS ramadan_subscriptions_pass_idx
  ON public.ramadan_subscriptions (pass_code);
CREATE INDEX IF NOT EXISTS ramadan_checkins_restaurant_date_idx
  ON public.ramadan_checkins (restaurant_id, checkin_date);

ALTER TABLE public.ramadan_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ramadan_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ramadan_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_isolation" ON public.ramadan_packages;
CREATE POLICY "restaurant_isolation" ON public.ramadan_packages
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

DROP POLICY IF EXISTS "restaurant_isolation" ON public.ramadan_subscriptions;
CREATE POLICY "restaurant_isolation" ON public.ramadan_subscriptions
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

DROP POLICY IF EXISTS "restaurant_isolation" ON public.ramadan_checkins;
CREATE POLICY "restaurant_isolation" ON public.ramadan_checkins
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

-- 2.2 Event spaces + bookings + table reservations
CREATE TABLE IF NOT EXISTS public.event_spaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity integer,
  description text,
  price_per_event numeric,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  space_id uuid REFERENCES public.event_spaces(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('wedding','graduation','corporate','birthday','meeting','other')),
  event_name text,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_organization text,
  event_date date NOT NULL,
  start_time time,
  end_time time,
  guest_count integer,
  menu_package text,
  total_price numeric,
  deposit_paid numeric DEFAULT 0,
  balance_due_date date,
  status text DEFAULT 'inquiry' CHECK (status IN ('inquiry','confirmed','cancelled','completed')),
  notes text,
  booking_source text DEFAULT 'direct' CHECK (booking_source IN ('direct','online_link','phone','walkin')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.table_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  guest_count integer NOT NULL,
  reservation_date date NOT NULL,
  reservation_time time NOT NULL,
  special_requests text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  deposit_paid numeric DEFAULT 0,
  booking_source text DEFAULT 'direct',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_spaces_restaurant_idx ON public.event_spaces (restaurant_id);
CREATE INDEX IF NOT EXISTS event_bookings_restaurant_date_idx
  ON public.event_bookings (restaurant_id, event_date);
CREATE INDEX IF NOT EXISTS table_reservations_restaurant_date_idx
  ON public.table_reservations (restaurant_id, reservation_date);

ALTER TABLE public.event_spaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.table_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_isolation" ON public.event_spaces;
CREATE POLICY "restaurant_isolation" ON public.event_spaces
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

DROP POLICY IF EXISTS "restaurant_isolation" ON public.event_bookings;
CREATE POLICY "restaurant_isolation" ON public.event_bookings
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

DROP POLICY IF EXISTS "restaurant_isolation" ON public.table_reservations;
CREATE POLICY "restaurant_isolation" ON public.table_reservations
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

-- Public registration / booking inserts need service-role or anon policies.
-- Authenticated staff keep restaurant_isolation; anon has no access (API uses service role).
