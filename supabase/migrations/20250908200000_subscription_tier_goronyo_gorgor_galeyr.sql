-- Step 1.3 — Add new subscription tier values WITHOUT removing legacy ones.
-- Safe / additive: starter and pro remain valid. No restaurant rows are updated.
--
-- DO NOT apply until Step 1.2 baseline is captured and verified.
-- Apply (after confirmation):
--   node scripts/supabase-db.mjs db query --linked -f supabase/migrations/20250908200000_subscription_tier_goronyo_gorgor_galeyr.sql

ALTER TYPE public.subscription_tier ADD VALUE IF NOT EXISTS 'goronyo';
ALTER TYPE public.subscription_tier ADD VALUE IF NOT EXISTS 'gorgor';
ALTER TYPE public.subscription_tier ADD VALUE IF NOT EXISTS 'galeyr';

COMMENT ON TYPE public.subscription_tier IS
  'trial | starter | pro (legacy) | goronyo | gorgor | galeyr (new 3-tier model). Legacy values remain until Step 1.8.';
