-- Step 1.2 rollback: restore live tenants to pre-migration subscription state.
-- Captured at: 2026-09-09T19:58:43.805Z
-- NEVER change subscription_end_date during forward tier migration.
--
-- Apply:
--   node scripts/supabase-db.mjs db query --linked -f scripts/tier-migration-rollback.sql
-- Verify after apply:
--   node scripts/verify-tier-migration-rollback.mjs --live

BEGIN;

-- Baba's Grill and Cafe (baba-s-grill-and-cafe)
UPDATE public.restaurants SET
  subscription_tier = 'pro'::public.subscription_tier,
  subscription_status = 'active'::public.subscription_status,
  subscription_end_date = '2026-11-08T23:36:14.703+03:00'::timestamptz,
  payment_mode = 'ussd'::public.payment_mode
WHERE slug = 'baba-s-grill-and-cafe';

-- Boba - Hergeisa (boba-hergeisa)
UPDATE public.restaurants SET
  subscription_tier = 'pro'::public.subscription_tier,
  subscription_status = 'active'::public.subscription_status,
  subscription_end_date = '2026-09-11T11:18:12.873+03:00'::timestamptz,
  payment_mode = 'ussd'::public.payment_mode
WHERE slug = 'boba-hergeisa';

-- Hilaac Safari Grill (hilaac-safari)
UPDATE public.restaurants SET
  subscription_tier = 'pro'::public.subscription_tier,
  subscription_status = 'active'::public.subscription_status,
  subscription_end_date = '2026-09-02T01:19:17.362+03:00'::timestamptz,
  payment_mode = 'ussd'::public.payment_mode
WHERE slug = 'hilaac-safari';

COMMIT;
