-- Manual platform "Remind" cooldown: last successful subscription reminder send.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS last_subscription_reminder_at timestamptz;

COMMENT ON COLUMN public.restaurants.last_subscription_reminder_at IS
  'When a platform admin last successfully sent a subscription reminder for this tenant. Used as a 1-hour duplicate-send guard.';
