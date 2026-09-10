-- Section 3 — AI systems: briefings, anomaly alerts, outreach log, order status messages
-- Idempotent. Do not push to production until explicitly approved.

-- Pre-check notes (verify before create):
--   information_schema.tables: daily_briefings, ai_alerts, customer_outreach_log
--   information_schema.columns: orders.status_message, profiles.preferred_language

-- ── Daily briefings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  briefing_date date NOT NULL,
  content text NOT NULL,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'so')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, briefing_date)
);

CREATE INDEX IF NOT EXISTS daily_briefings_restaurant_date_idx
  ON public.daily_briefings (restaurant_id, briefing_date DESC);

ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_isolation" ON public.daily_briefings;
CREATE POLICY "restaurant_isolation" ON public.daily_briefings
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

-- ── AI anomaly alerts (persisted; live system alerts stay computed) ──
CREATE TABLE IF NOT EXISTS public.ai_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  severity text NOT NULL CHECK (severity IN ('urgent', 'important', 'normal')),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  why_it_matters text NOT NULL DEFAULT '',
  action_label text NOT NULL DEFAULT 'Review',
  href text NOT NULL DEFAULT '/',
  source text NOT NULL DEFAULT 'ai' CHECK (source IN ('ai', 'system')),
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  dismissed_at timestamptz
);

CREATE INDEX IF NOT EXISTS ai_alerts_restaurant_active_idx
  ON public.ai_alerts (restaurant_id, created_at DESC)
  WHERE dismissed_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_alerts_restaurant_dedupe_active_uidx
  ON public.ai_alerts (restaurant_id, dedupe_key)
  WHERE dismissed_at IS NULL;

ALTER TABLE public.ai_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_isolation" ON public.ai_alerts;
CREATE POLICY "restaurant_isolation" ON public.ai_alerts
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

-- ── Customer outreach log ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_outreach_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  message text NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS customer_outreach_log_restaurant_idx
  ON public.customer_outreach_log (restaurant_id, sent_at DESC);

ALTER TABLE public.customer_outreach_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_isolation" ON public.customer_outreach_log;
CREATE POLICY "restaurant_isolation" ON public.customer_outreach_log
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

-- ── Order AI status message ────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS status_message text;

-- ── Owner briefing language preference ─────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ALTER COLUMN preferred_language SET DEFAULT 'en';
EXCEPTION
  WHEN undefined_column THEN NULL;
END $$;

UPDATE public.profiles
SET preferred_language = 'en'
WHERE preferred_language IS NULL;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_preferred_language_check
    CHECK (preferred_language IN ('en', 'so'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
