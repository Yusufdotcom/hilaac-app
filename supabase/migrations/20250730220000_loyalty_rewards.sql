-- Punch-card loyalty: Order X times → earn reward. Progress keyed by phone per restaurant.
-- Credit runs when an order first reaches delivered/completed (idempotent per order_id).
-- Progress resets toward the next card when a reward is earned; redemption only spends available_rewards.

create table if not exists public.loyalty_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  enabled boolean not null default false,
  target_order_count int not null default 5
    check (target_order_count >= 2 and target_order_count <= 100),
  reward_description text not null default 'Free item',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_progress (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  phone_normalized text not null,
  current_count int not null default 0 check (current_count >= 0),
  available_rewards int not null default 0 check (available_rewards >= 0),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, phone_normalized)
);

create index if not exists idx_loyalty_progress_restaurant_phone
  on public.loyalty_progress (restaurant_id, phone_normalized);

create index if not exists idx_loyalty_progress_restaurant_rewards
  on public.loyalty_progress (restaurant_id)
  where available_rewards > 0;

-- Idempotency: each order credits at most once.
create table if not exists public.loyalty_order_credits (
  order_id uuid primary key references public.orders (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  phone_normalized text not null,
  credited_at timestamptz not null default now()
);

create index if not exists idx_loyalty_order_credits_restaurant
  on public.loyalty_order_credits (restaurant_id);

create table if not exists public.loyalty_redemptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  phone_normalized text not null,
  redeemed_by uuid not null references public.profiles (id),
  redeemed_at timestamptz not null default now()
);

create index if not exists idx_loyalty_redemptions_restaurant
  on public.loyalty_redemptions (restaurant_id, redeemed_at desc);

-- Normalize customer phones for loyalty keys (digits only; leading 0 → 252).
create or replace function public.normalize_loyalty_phone(p_phone text)
returns text
language plpgsql
immutable
as $$
declare
  digits text;
begin
  if p_phone is null then
    return null;
  end if;
  digits := regexp_replace(p_phone, '\D', '', 'g');
  if digits = '' then
    return null;
  end if;
  if left(digits, 1) = '0' then
    digits := '252' || substr(digits, 2);
  end if;
  if length(digits) < 8 then
    return null;
  end if;
  return digits;
end;
$$;

create or replace function public.credit_loyalty_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_settings public.loyalty_settings%rowtype;
  v_phone text;
  v_inserted int;
  v_count int;
  v_rewards int;
  v_target int;
begin
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    return;
  end if;

  if v_order.status not in ('delivered', 'completed') then
    return;
  end if;

  select * into v_settings
  from public.loyalty_settings
  where restaurant_id = v_order.restaurant_id;

  if not found or not v_settings.enabled then
    return;
  end if;

  v_phone := public.normalize_loyalty_phone(v_order.customer_phone);
  if v_phone is null then
    return;
  end if;

  insert into public.loyalty_order_credits (order_id, restaurant_id, phone_normalized)
  values (v_order.id, v_order.restaurant_id, v_phone)
  on conflict (order_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return;
  end if;

  insert into public.loyalty_progress (
    restaurant_id, phone_normalized, current_count, available_rewards, updated_at
  )
  values (v_order.restaurant_id, v_phone, 0, 0, now())
  on conflict (restaurant_id, phone_normalized) do nothing;

  select current_count, available_rewards
  into v_count, v_rewards
  from public.loyalty_progress
  where restaurant_id = v_order.restaurant_id
    and phone_normalized = v_phone
  for update;

  v_count := v_count + 1;
  v_target := v_settings.target_order_count;

  -- Earn rewards and reset the punch card (remainder rolls into the next card).
  while v_count >= v_target loop
    v_rewards := v_rewards + 1;
    v_count := v_count - v_target;
  end loop;

  update public.loyalty_progress
  set current_count = v_count,
      available_rewards = v_rewards,
      updated_at = now()
  where restaurant_id = v_order.restaurant_id
    and phone_normalized = v_phone;
end;
$$;

create or replace function public.trg_orders_credit_loyalty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status in ('delivered', 'completed')
     and (old.status is distinct from new.status)
     and coalesce(old.status, '') not in ('delivered', 'completed') then
    perform public.credit_loyalty_for_order(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists orders_credit_loyalty on public.orders;
create trigger orders_credit_loyalty
  after update of status on public.orders
  for each row
  execute function public.trg_orders_credit_loyalty();

-- Redeem one available reward (staff-only via grants / API).
create or replace function public.redeem_loyalty_reward(
  p_restaurant_id uuid,
  p_phone text,
  p_staff_id uuid
)
returns table (
  phone_normalized text,
  current_count int,
  available_rewards int,
  reward_description text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_settings public.loyalty_settings%rowtype;
  v_count int;
  v_rewards int;
begin
  if public.get_my_restaurant_id() is distinct from p_restaurant_id then
    raise exception 'Unauthorized';
  end if;

  if public.get_my_role() not in ('owner', 'manager', 'cashier') then
    raise exception 'Unauthorized';
  end if;

  if p_staff_id is distinct from auth.uid() then
    raise exception 'Unauthorized';
  end if;

  select * into v_settings
  from public.loyalty_settings
  where restaurant_id = p_restaurant_id;

  if not found or not v_settings.enabled then
    raise exception 'Loyalty program is not enabled';
  end if;

  v_phone := public.normalize_loyalty_phone(p_phone);
  if v_phone is null then
    raise exception 'Invalid phone number';
  end if;

  select lp.current_count, lp.available_rewards
  into v_count, v_rewards
  from public.loyalty_progress lp
  where lp.restaurant_id = p_restaurant_id
    and lp.phone_normalized = v_phone
  for update;

  if not found or v_rewards < 1 then
    raise exception 'No available reward for this phone number';
  end if;

  v_rewards := v_rewards - 1;

  update public.loyalty_progress
  set available_rewards = v_rewards,
      updated_at = now()
  where restaurant_id = p_restaurant_id
    and phone_normalized = v_phone;

  insert into public.loyalty_redemptions (restaurant_id, phone_normalized, redeemed_by)
  values (p_restaurant_id, v_phone, p_staff_id);

  return query
  select v_phone, v_count, v_rewards, v_settings.reward_description;
end;
$$;

create or replace function public.set_loyalty_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists loyalty_settings_set_updated_at on public.loyalty_settings;
create trigger loyalty_settings_set_updated_at
  before update on public.loyalty_settings
  for each row
  execute function public.set_loyalty_settings_updated_at();

alter table public.loyalty_settings enable row level security;
alter table public.loyalty_progress enable row level security;
alter table public.loyalty_order_credits enable row level security;
alter table public.loyalty_redemptions enable row level security;

-- Settings: staff can read; managers/owners manage.
drop policy if exists "staff can view loyalty settings" on public.loyalty_settings;
create policy "staff can view loyalty settings" on public.loyalty_settings
  for select using (restaurant_id = public.get_my_restaurant_id());

drop policy if exists "managers can manage loyalty settings" on public.loyalty_settings;
create policy "managers can manage loyalty settings" on public.loyalty_settings
  for all using (
    restaurant_id = public.get_my_restaurant_id()
    and public.is_manager_or_owner()
  )
  with check (
    restaurant_id = public.get_my_restaurant_id()
    and public.is_manager_or_owner()
  );

-- Progress / credits / redemptions: staff read; cashiers+ can update via redeem RPC (security definer).
drop policy if exists "staff can view loyalty progress" on public.loyalty_progress;
create policy "staff can view loyalty progress" on public.loyalty_progress
  for select using (restaurant_id = public.get_my_restaurant_id());

drop policy if exists "staff can view loyalty credits" on public.loyalty_order_credits;
create policy "staff can view loyalty credits" on public.loyalty_order_credits
  for select using (restaurant_id = public.get_my_restaurant_id());

drop policy if exists "staff can view loyalty redemptions" on public.loyalty_redemptions;
create policy "staff can view loyalty redemptions" on public.loyalty_redemptions
  for select using (restaurant_id = public.get_my_restaurant_id());

grant select on public.loyalty_settings to authenticated;
grant select, insert, update on public.loyalty_settings to authenticated;

grant select on public.loyalty_progress to authenticated;
grant select on public.loyalty_order_credits to authenticated;
grant select on public.loyalty_redemptions to authenticated;

grant execute on function public.normalize_loyalty_phone(text) to authenticated, service_role;
grant execute on function public.credit_loyalty_for_order(uuid) to service_role;
grant execute on function public.redeem_loyalty_reward(uuid, text, uuid) to authenticated;
