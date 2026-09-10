-- Event booking ops: P&L cost estimate + reminder dedupe timestamps
ALTER TABLE public.event_bookings
  ADD COLUMN IF NOT EXISTS estimated_cost numeric,
  ADD COLUMN IF NOT EXISTS reminder_7d_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_48h_sent_at timestamptz;

COMMENT ON COLUMN public.event_bookings.estimated_cost IS
  'Optional estimated cost for post-event P&L (Somali Airlines).';
COMMENT ON COLUMN public.event_bookings.reminder_7d_sent_at IS
  'When the 7-day balance/event reminder was sent.';
COMMENT ON COLUMN public.event_bookings.reminder_48h_sent_at IS
  'When the 48-hour event reminder was sent.';
