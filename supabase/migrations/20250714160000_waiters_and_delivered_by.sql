-- Waiter names for shared-tablet delivery tracking
create table if not exists public.waiters (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create index if not exists idx_waiters_restaurant on public.waiters (restaurant_id);

alter table public.orders
  add column if not exists delivered_by text;

alter table public.waiters enable row level security;

drop policy if exists "staff can view own waiters" on public.waiters;
create policy "staff can view own waiters" on public.waiters
  for select using (restaurant_id = public.get_my_restaurant_id());

drop policy if exists "managers can manage waiters" on public.waiters;
create policy "managers can manage waiters" on public.waiters
  for all using (
    restaurant_id = public.get_my_restaurant_id()
    and public.is_manager_or_owner()
  )
  with check (
    restaurant_id = public.get_my_restaurant_id()
    and public.is_manager_or_owner()
  );
