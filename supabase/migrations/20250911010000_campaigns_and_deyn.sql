-- Campaigns + Deyn ledger (promo codes and self-service credit)

-- payment_method: add deyn
DO $$ BEGIN
  ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'deyn';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── Campaigns ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value numeric NOT NULL CHECK (discount_value > 0),
  valid_from date NOT NULL,
  valid_to date NOT NULL,
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  uses_count integer NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  min_order_amount numeric CHECK (min_order_amount IS NULL OR min_order_amount >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaigns_date_range CHECK (valid_to >= valid_from),
  CONSTRAINT campaigns_code_upper CHECK (code = upper(code) AND code !~ '\s'),
  CONSTRAINT campaigns_restaurant_code_unique UNIQUE (restaurant_id, code)
);

CREATE TABLE IF NOT EXISTS public.campaign_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_phone text,
  discount_applied numeric NOT NULL DEFAULT 0,
  order_total_before numeric,
  order_total_after numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_redemptions_order_unique UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS campaigns_restaurant_idx ON public.campaigns (restaurant_id);
CREATE INDEX IF NOT EXISTS campaign_redemptions_campaign_idx ON public.campaign_redemptions (campaign_id);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_isolation" ON public.campaigns;
CREATE POLICY "restaurant_isolation" ON public.campaigns
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

DROP POLICY IF EXISTS "restaurant_isolation" ON public.campaign_redemptions;
CREATE POLICY "restaurant_isolation" ON public.campaign_redemptions
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

-- ── Deyn ledger ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deyn_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  deyn_code text NOT NULL,
  credit_limit numeric NOT NULL CHECK (credit_limit >= 0),
  -- Amount currently owed (sum of charges − payments)
  balance numeric NOT NULL DEFAULT 0 CHECK (balance >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deyn_accounts_code_unique UNIQUE (deyn_code),
  CONSTRAINT deyn_accounts_code_format CHECK (deyn_code ~ '^[A-Z0-9]{8}$')
);

CREATE TABLE IF NOT EXISTS public.deyn_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  deyn_account_id uuid NOT NULL REFERENCES public.deyn_accounts(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('charge', 'payment', 'adjustment')),
  amount numeric NOT NULL CHECK (amount > 0),
  note text,
  override_limit boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deyn_accounts_restaurant_idx ON public.deyn_accounts (restaurant_id);
CREATE INDEX IF NOT EXISTS deyn_accounts_code_idx ON public.deyn_accounts (deyn_code);
CREATE INDEX IF NOT EXISTS deyn_transactions_account_idx ON public.deyn_transactions (deyn_account_id);

ALTER TABLE public.deyn_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deyn_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "restaurant_isolation" ON public.deyn_accounts;
CREATE POLICY "restaurant_isolation" ON public.deyn_accounts
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

DROP POLICY IF EXISTS "restaurant_isolation" ON public.deyn_transactions;
CREATE POLICY "restaurant_isolation" ON public.deyn_transactions
  FOR ALL
  USING (restaurant_id = public.get_my_restaurant_id())
  WITH CHECK (restaurant_id = public.get_my_restaurant_id());

-- Order promo / deyn fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_discount numeric,
  ADD COLUMN IF NOT EXISTS promo_code text,
  ADD COLUMN IF NOT EXISTS deyn_code text,
  ADD COLUMN IF NOT EXISTS deyn_account_id uuid REFERENCES public.deyn_accounts(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.deyn_accounts.deyn_code IS
  '8-char alphanumeric self-service code; unique globally, validated per restaurant_id on use.';
COMMENT ON COLUMN public.orders.deyn_code IS
  'Deyn code entered at checkout (payment_method = deyn).';
