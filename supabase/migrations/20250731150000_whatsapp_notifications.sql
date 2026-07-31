-- WhatsApp notifications (Twilio): per-restaurant settings, contacts, send log.

alter table public.orders
  add column if not exists whatsapp_marketing_opt_in boolean not null default false;

create table if not exists public.whatsapp_settings (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  order_ready_enabled boolean not null default false,
  reengagement_enabled boolean not null default false,
  reengagement_idle_days int not null default 14
    check (reengagement_idle_days >= 7 and reengagement_idle_days <= 90),
  reengagement_min_interval_days int not null default 21
    check (reengagement_min_interval_days >= 14 and reengagement_min_interval_days <= 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.whatsapp_contacts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  phone_normalized text not null,
  marketing_opt_in boolean not null default false,
  opted_out_at timestamptz,
  last_reengagement_sent_at timestamptz,
  last_order_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (restaurant_id, phone_normalized)
);

create index if not exists idx_whatsapp_contacts_restaurant_phone
  on public.whatsapp_contacts (restaurant_id, phone_normalized);

create index if not exists idx_whatsapp_contacts_reengage
  on public.whatsapp_contacts (restaurant_id, last_order_at)
  where marketing_opt_in = true and opted_out_at is null;

create table if not exists public.whatsapp_message_log (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  phone_normalized text not null,
  message_type text not null check (message_type in ('order_ready', 'reengagement')),
  order_id uuid references public.orders (id) on delete set null,
  status text not null check (status in ('dry_run', 'queued', 'sent', 'failed', 'skipped')),
  provider_sid text,
  error_message text,
  estimated_cost_usd numeric(10, 4),
  created_at timestamptz not null default now()
);

create index if not exists idx_whatsapp_message_log_restaurant_month
  on public.whatsapp_message_log (restaurant_id, created_at desc);

-- At most one order-ready attempt per order.
create unique index if not exists idx_whatsapp_message_log_order_ready
  on public.whatsapp_message_log (order_id)
  where message_type = 'order_ready' and order_id is not null
    and status in ('dry_run', 'queued', 'sent');

create or replace function public.set_whatsapp_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists whatsapp_settings_set_updated_at on public.whatsapp_settings;
create trigger whatsapp_settings_set_updated_at
  before update on public.whatsapp_settings
  for each row
  execute function public.set_whatsapp_settings_updated_at();

alter table public.whatsapp_settings enable row level security;
alter table public.whatsapp_contacts enable row level security;
alter table public.whatsapp_message_log enable row level security;

drop policy if exists "staff can view whatsapp settings" on public.whatsapp_settings;
create policy "staff can view whatsapp settings" on public.whatsapp_settings
  for select using (restaurant_id = public.get_my_restaurant_id());

drop policy if exists "managers can manage whatsapp settings" on public.whatsapp_settings;
create policy "managers can manage whatsapp settings" on public.whatsapp_settings
  for all using (
    restaurant_id = public.get_my_restaurant_id()
    and public.is_manager_or_owner()
  )
  with check (
    restaurant_id = public.get_my_restaurant_id()
    and public.is_manager_or_owner()
  );

drop policy if exists "managers can view whatsapp contacts" on public.whatsapp_contacts;
create policy "managers can view whatsapp contacts" on public.whatsapp_contacts
  for select using (
    restaurant_id = public.get_my_restaurant_id()
    and public.is_manager_or_owner()
  );

drop policy if exists "managers can view whatsapp message log" on public.whatsapp_message_log;
create policy "managers can view whatsapp message log" on public.whatsapp_message_log
  for select using (
    restaurant_id = public.get_my_restaurant_id()
    and public.is_manager_or_owner()
  );

grant select on public.whatsapp_settings to authenticated;
grant select, insert, update on public.whatsapp_settings to authenticated;
grant select on public.whatsapp_contacts to authenticated;
grant select on public.whatsapp_message_log to authenticated;
