-- ============================================================================
-- HILAAC — Multi-tenant Restaurant SaaS
-- Full Supabase schema: extensions, enums, tables, functions, triggers, RLS
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUM TYPES
-- ----------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('owner', 'manager', 'waiter', 'kitchen', 'cashier');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_mode as enum ('ussd', 'api');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_tier as enum ('trial', 'starter', 'pro');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('active', 'expired');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_type as enum ('dine-in', 'takeaway');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum ('new', 'preparing', 'ready', 'delivered', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_status as enum ('pending', 'pending_cashier_confirmation', 'paid', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.payment_method as enum ('evc', 'edahab');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. TABLES
-- ----------------------------------------------------------------------------

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  previous_slug text,
  branch_name text,
  owner_id uuid references auth.users (id) on delete set null,
  logo_url text,
  address text,
  phone text,
  payment_mode public.payment_mode not null default 'ussd',
  subscription_tier public.subscription_tier not null default 'trial',
  subscription_status public.subscription_status not null default 'active',
  subscription_end_date timestamptz not null default (now() + interval '7 days'),
  evc_ussd_code text,
  edahab_ussd_code text,
  evc_merchant_id_encrypted text,
  evc_api_key_encrypted text,
  edahab_merchant_id_encrypted text,
  edahab_api_key_encrypted text,
  dine_in_enabled boolean not null default true,
  takeaway_enabled boolean not null default true,
  brand_color text default '#0F172A',
  custom_branding_enabled boolean not null default false,
  is_active boolean not null default true,
  is_demo boolean not null default false,
  demo_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.restaurants is 'Tenant record. One row per restaurant / customer of Hilaac.';

-- Existing databases: run once if owner_id is missing or disallows NULL for demos
-- alter table public.restaurants add column if not exists owner_id uuid references auth.users (id) on delete set null;
-- alter table public.restaurants alter column owner_id drop not null;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  role public.user_role not null default 'owner',
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'Staff/user profile, 1:1 with auth.users, scoped to a restaurant.';

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_number text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, table_number)
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid references public.categories (id) on delete set null,
  name text not null,
  description text,
  ingredients text,
  price numeric(10, 2) not null default 0,
  image_url text,
  is_available boolean not null default true,
  is_top_pick boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.add_ons (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  price numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.waiters (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (restaurant_id, name)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number integer,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid references public.tables (id) on delete set null,
  order_type public.order_type not null default 'dine-in',
  status public.order_status not null default 'new',
  payment_status public.payment_status not null default 'pending',
  payment_method public.payment_method,
  payment_reference text,
  total numeric(10, 2) not null default 0,
  customer_phone text,
  notes text,
  delivered_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  quantity int not null default 1,
  add_ons jsonb not null default '[]'::jsonb,
  notes text,
  price_at_time numeric(10, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. INDEXES
-- ----------------------------------------------------------------------------
create index if not exists idx_profiles_restaurant on public.profiles (restaurant_id);
create index if not exists idx_tables_restaurant on public.tables (restaurant_id);
create index if not exists idx_categories_restaurant on public.categories (restaurant_id);
create index if not exists idx_menu_items_restaurant on public.menu_items (restaurant_id);
create index if not exists idx_menu_items_category on public.menu_items (category_id);
create index if not exists idx_add_ons_restaurant on public.add_ons (restaurant_id);
create index if not exists idx_waiters_restaurant on public.waiters (restaurant_id);
create index if not exists idx_orders_restaurant on public.orders (restaurant_id);
create index if not exists idx_orders_status on public.orders (restaurant_id, status);
create index if not exists idx_orders_created_at on public.orders (restaurant_id, created_at desc);
create index if not exists idx_order_items_order on public.order_items (order_id);

-- ----------------------------------------------------------------------------
-- 4. updated_at TRIGGER HELPER
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_restaurants_updated_at on public.restaurants;
create trigger trg_restaurants_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_menu_items_updated_at on public.menu_items;
create trigger trg_menu_items_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at before update on public.orders
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. AUTH HELPER FUNCTIONS (security definer, used inside RLS policies)
-- ----------------------------------------------------------------------------
create or replace function public.get_my_restaurant_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select restaurant_id from public.profiles where id = auth.uid();
$$;

create or replace function public.get_my_role()
returns public.user_role
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_manager_or_owner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(public.get_my_role() in ('owner', 'manager'), false);
$$;


-- ----------------------------------------------------------------------------
-- 6. ONBOARDING RPC — creates restaurant + owner profile atomically.
-- Called from the client immediately after supabase.auth.signUp() succeeds,
-- while the new user's session (auth.uid()) is already available.
-- ----------------------------------------------------------------------------
create or replace function public.create_restaurant_and_owner(
  p_restaurant_name text,
  p_slug text,
  p_full_name text,
  p_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Profile already exists for this user';
  end if;

  insert into public.restaurants (name, slug, owner_id, subscription_tier, subscription_status, subscription_end_date)
  values (p_restaurant_name, p_slug, auth.uid(), 'trial', 'active', now() + interval '7 days')
  returning id into v_restaurant_id;

  insert into public.profiles (id, restaurant_id, role, full_name, phone)
  values (auth.uid(), v_restaurant_id, 'owner', p_full_name, p_phone);

  -- seed a default table and two starter categories so the dashboard isn't empty
  insert into public.tables (restaurant_id, table_number) values (v_restaurant_id, '1');
  insert into public.categories (restaurant_id, name, display_order) values
    (v_restaurant_id, 'Cuntooyinka Ugu Weyn', 0),
    (v_restaurant_id, 'Cabitaannada', 1);

  return v_restaurant_id;
end;
$$;

grant execute on function public.create_restaurant_and_owner(text, text, text, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 6b. DEMO RESTAURANT — anonymous "Try Demo" button on the landing page.
-- Creates a throwaway restaurant (slug demo-xxxxxx) pre-seeded with a menu,
-- expiring in 24 hours. A scheduled job (see /api/jobs/demo-cleanup) purges
-- expired demo restaurants by calling public.cleanup_expired_demos().
-- ----------------------------------------------------------------------------
create or replace function public.create_demo_restaurant()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant_id uuid;
  v_slug text := 'demo-' || substr(md5(random()::text), 1, 8);
  v_cat_food uuid;
  v_cat_drink uuid;
begin
  insert into public.restaurants (
    name, slug, payment_mode, subscription_tier, subscription_status,
    subscription_end_date, is_demo, demo_expires_at, evc_ussd_code, edahab_ussd_code
  ) values (
    'Hilaac Demo Restaurant', v_slug, 'ussd', 'pro', 'active',
    now() + interval '30 days', true, now() + interval '24 hours', '*712*1*1#', '*888*1*1#'
  ) returning id into v_restaurant_id;

  insert into public.tables (restaurant_id, table_number) values
    (v_restaurant_id, '1'), (v_restaurant_id, '2'), (v_restaurant_id, '3');

  insert into public.categories (restaurant_id, name, display_order) values
    (v_restaurant_id, 'Cuntooyinka', 0) returning id into v_cat_food;
  insert into public.categories (restaurant_id, name, display_order) values
    (v_restaurant_id, 'Cabitaannada', 1) returning id into v_cat_drink;

  insert into public.menu_items (restaurant_id, category_id, name, description, price, is_top_pick) values
    (v_restaurant_id, v_cat_food, 'Hilib Ari + Bariis', 'Grilled goat meat served with spiced rice', 6.50, true),
    (v_restaurant_id, v_cat_food, 'Muufo & Suqaar', 'Traditional flatbread with sauteed beef', 4.00, true),
    (v_restaurant_id, v_cat_food, 'Baasto Somali', 'Somali-style spiced pasta', 3.50, false),
    (v_restaurant_id, v_cat_drink, 'Shaah Somali', 'Spiced Somali tea', 1.00, true),
    (v_restaurant_id, v_cat_drink, 'Cabbaar Cusub', 'Fresh fruit juice', 2.00, false);

  return v_slug;
end;
$$;

grant execute on function public.create_demo_restaurant() to anon, authenticated;

create or replace function public.cleanup_expired_demos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.restaurants
  where is_demo = true and demo_expires_at < now();
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.restaurants enable row level security;
alter table public.profiles enable row level security;
alter table public.tables enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.add_ons enable row level security;
alter table public.waiters enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- ---- restaurants -----------------------------------------------------------
-- Public (anon + authenticated) can see active restaurants, but column grants
-- below strip out every encrypted secret so the anon key can never read them.
drop policy if exists "public can view active restaurants" on public.restaurants;
create policy "public can view active restaurants" on public.restaurants
  for select using (is_active = true);

drop policy if exists "staff can update own restaurant" on public.restaurants;
create policy "staff can update own restaurant" on public.restaurants
  for update using (id = public.get_my_restaurant_id() and public.is_manager_or_owner());

drop policy if exists "owners can view own restaurants" on public.restaurants;
create policy "owners can view own restaurants" on public.restaurants
  for select using (owner_id = auth.uid());

drop policy if exists "owners can insert own restaurants" on public.restaurants;
create policy "owners can insert own restaurants" on public.restaurants
  for insert with check (owner_id = auth.uid() and public.get_my_role() = 'owner');

drop policy if exists "owners can update own restaurants" on public.restaurants;
create policy "owners can update own restaurants" on public.restaurants
  for update using (owner_id = auth.uid() and public.get_my_role() = 'owner');

revoke all on public.restaurants from anon, authenticated;
grant select (
  id, name, slug, previous_slug, branch_name, owner_id, logo_url, address, phone, payment_mode, subscription_tier,
  subscription_status, subscription_end_date, evc_ussd_code, edahab_ussd_code,
  dine_in_enabled, takeaway_enabled, brand_color, custom_branding_enabled,
  is_active, is_demo, demo_expires_at, created_at
) on public.restaurants to anon, authenticated;
grant select (
  evc_merchant_id_encrypted, evc_api_key_encrypted, edahab_merchant_id_encrypted, edahab_api_key_encrypted
) on public.restaurants to authenticated;
grant update, insert on public.restaurants to authenticated;

-- ---- profiles ---------------------------------------------------------------
drop policy if exists "user can view own profile" on public.profiles;
create policy "user can view own profile" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "owner/manager can view restaurant staff" on public.profiles;
create policy "owner/manager can view restaurant staff" on public.profiles
  for select using (restaurant_id = public.get_my_restaurant_id() and public.is_manager_or_owner());

drop policy if exists "user can update own profile" on public.profiles;
create policy "user can update own profile" on public.profiles
  for update using (id = auth.uid());

drop policy if exists "owner/manager can manage staff" on public.profiles;
create policy "owner/manager can manage staff" on public.profiles
  for insert with check (restaurant_id = public.get_my_restaurant_id() and public.is_manager_or_owner());

drop policy if exists "owner/manager can update staff" on public.profiles;
create policy "owner/manager can update staff" on public.profiles
  for update using (restaurant_id = public.get_my_restaurant_id() and public.is_manager_or_owner());

drop policy if exists "owner/manager can remove staff" on public.profiles;
create policy "owner/manager can remove staff" on public.profiles
  for delete using (restaurant_id = public.get_my_restaurant_id() and public.is_manager_or_owner());

-- ---- tables ------------------------------------------------------------------
drop policy if exists "public can view active tables" on public.tables;
create policy "public can view active tables" on public.tables
  for select using (is_active = true);

drop policy if exists "staff can manage own tables" on public.tables;
create policy "staff can manage own tables" on public.tables
  for all using (restaurant_id = public.get_my_restaurant_id())
  with check (restaurant_id = public.get_my_restaurant_id());

-- ---- categories ----------------------------------------------------------------
drop policy if exists "public can view categories" on public.categories;
create policy "public can view categories" on public.categories
  for select using (true);

drop policy if exists "staff can manage own categories" on public.categories;
create policy "staff can manage own categories" on public.categories
  for all using (restaurant_id = public.get_my_restaurant_id())
  with check (restaurant_id = public.get_my_restaurant_id());

-- ---- menu_items -------------------------------------------------------------
drop policy if exists "public can view available menu items" on public.menu_items;
drop policy if exists "public can view menu items for active restaurants" on public.menu_items;
create policy "public can view menu items for active restaurants"
  on public.menu_items
  for select
  using (
    exists (
      select 1
      from public.restaurants r
      where r.id = restaurant_id and r.is_active = true
    )
  );

drop policy if exists "staff can view all own menu items" on public.menu_items;
create policy "staff can view all own menu items" on public.menu_items
  for select using (restaurant_id = public.get_my_restaurant_id());

drop policy if exists "staff can manage own menu items" on public.menu_items;
create policy "staff can manage own menu items" on public.menu_items
  for insert with check (restaurant_id = public.get_my_restaurant_id());

drop policy if exists "staff can update own menu items" on public.menu_items;
create policy "staff can update own menu items" on public.menu_items
  for update using (restaurant_id = public.get_my_restaurant_id());

drop policy if exists "staff can delete own menu items" on public.menu_items;
create policy "staff can delete own menu items" on public.menu_items
  for delete using (restaurant_id = public.get_my_restaurant_id());

-- ---- add_ons -----------------------------------------------------------------
drop policy if exists "public can view add_ons" on public.add_ons;
create policy "public can view add_ons" on public.add_ons
  for select using (true);

drop policy if exists "staff can manage own add_ons" on public.add_ons;
create policy "staff can manage own add_ons" on public.add_ons
  for all using (restaurant_id = public.get_my_restaurant_id())
  with check (restaurant_id = public.get_my_restaurant_id());

-- ---- waiters -----------------------------------------------------------------
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

-- ---- orders --------------------------------------------------------------------
-- Customers never talk to this table directly for writes (no anon INSERT
-- policies): order creation goes through POST /api/orders. For live status
-- tracking, anon may SELECT recent orders via column grants (status fields
-- only — same surface as GET /api/orders/[id]/track) so Realtime UPDATE
-- events can reach the customer confirmation screen.
drop policy if exists "public can create orders" on public.orders;
drop policy if exists "public can view order by id" on public.orders;

drop policy if exists "customers can track recent orders" on public.orders;
create policy "customers can track recent orders"
  on public.orders
  for select
  to anon
  using (created_at >= (now() - interval '7 days'));

revoke all on public.orders from anon;
grant select (
  id, order_number, status, payment_status, order_type, billing_model,
  customer_confirmed_at, total, created_at, updated_at
) on public.orders to anon;

drop policy if exists "customers can confirm payment on recent orders" on public.orders;

drop policy if exists "staff can view own restaurant orders" on public.orders;
create policy "staff can view own restaurant orders" on public.orders
  for select using (restaurant_id = public.get_my_restaurant_id());

drop policy if exists "staff can update own restaurant orders" on public.orders;
create policy "staff can update own restaurant orders" on public.orders
  for update using (restaurant_id = public.get_my_restaurant_id());

drop policy if exists "service role can update orders" on public.orders;
create policy "service role can update orders" on public.orders
  for update using (auth.role() = 'service_role');

grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- ---- order_items ------------------------------------------------------------
-- Same reasoning as orders: no anon policies at all, only staff SELECT.
drop policy if exists "public can create order_items" on public.order_items;
drop policy if exists "public can view order_items" on public.order_items;

drop policy if exists "staff can view own order_items" on public.order_items;
create policy "staff can view own order_items" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.restaurant_id = public.get_my_restaurant_id()
    )
  );

-- ----------------------------------------------------------------------------
-- 8. STORAGE BUCKETS (logos + AI-generated menu images)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('restaurant-logos', 'restaurant-logos', true)
on conflict (id) do nothing;

drop policy if exists "public read menu-images" on storage.objects;
create policy "public read menu-images" on storage.objects
  for select using (bucket_id = 'menu-images');

drop policy if exists "staff upload menu-images" on storage.objects;
create policy "staff upload menu-images" on storage.objects
  for insert with check (bucket_id = 'menu-images' and auth.role() = 'authenticated');

drop policy if exists "staff update menu-images" on storage.objects;
create policy "staff update menu-images" on storage.objects
  for update using (bucket_id = 'menu-images' and auth.role() = 'authenticated');

drop policy if exists "public read restaurant-logos" on storage.objects;
create policy "public read restaurant-logos" on storage.objects
  for select using (bucket_id = 'restaurant-logos');

drop policy if exists "staff upload restaurant-logos" on storage.objects;
create policy "staff upload restaurant-logos" on storage.objects
  for insert with check (bucket_id = 'restaurant-logos' and auth.role() = 'authenticated');

drop policy if exists "staff update restaurant-logos" on storage.objects;
create policy "staff update restaurant-logos" on storage.objects
  for update using (bucket_id = 'restaurant-logos' and auth.role() = 'authenticated');

-- ----------------------------------------------------------------------------
-- 9. REALTIME
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.menu_items;
