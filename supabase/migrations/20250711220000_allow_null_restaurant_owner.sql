-- Allow demo restaurants to be created without an owner in auth.users.
-- Run this in the Supabase SQL editor if Try Demo fails with fk_restaurants_owner.

alter table public.restaurants
  alter column owner_id drop not null;

-- Re-assert FK allows NULL (no-op if constraint already exists correctly)
alter table public.restaurants
  drop constraint if exists fk_restaurants_owner;

alter table public.restaurants
  add constraint fk_restaurants_owner
  foreign key (owner_id)
  references auth.users (id)
  on delete set null;
