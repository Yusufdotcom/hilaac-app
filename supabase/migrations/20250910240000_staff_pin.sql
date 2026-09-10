-- Staff PIN for shared tablet login (Kitchen / Waiter / Cashier).
-- Hash only — never store plaintext. Cleared when staff deactivated.

alter table public.profiles
  add column if not exists staff_pin_hash text;

alter table public.profiles
  add column if not exists pin_last_used timestamptz;

comment on column public.profiles.staff_pin_hash is
  'scrypt hash of 4–6 digit staff PIN; null = PIN login disabled';
comment on column public.profiles.pin_last_used is
  'Last successful PIN login timestamp';
