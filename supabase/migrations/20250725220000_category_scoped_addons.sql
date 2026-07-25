-- Category-scoped add-ons + special-instructions placeholders
-- with optional per-item overrides.
--
-- MIGRATION PLAN (data preservation):
-- 1) Keep `add_ons` as the restaurant-wide catalog (name + price).
-- 2) New `category_add_ons` assigns catalog add-ons to categories.
-- 3) New `menu_item_add_ons` + `menu_items.use_custom_add_ons` for overrides.
-- 4) Seed: attach every existing add-on to every NON-DRINKS category
--    in the same restaurant (food keeps cheese/onion options).
-- 5) Orphan safety: if an add-on would have zero category links
--    (restaurant has only drink categories / no categories), attach it
--    to all of that restaurant's categories so nothing is lost.
-- 6) Seed drink-like category placeholders; food left null → app default.

alter table public.categories
  add column if not exists special_instructions_placeholder text;

alter table public.menu_items
  add column if not exists use_custom_add_ons boolean not null default false;

create table if not exists public.category_add_ons (
  category_id uuid not null references public.categories (id) on delete cascade,
  add_on_id uuid not null references public.add_ons (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (category_id, add_on_id)
);

create table if not exists public.menu_item_add_ons (
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  add_on_id uuid not null references public.add_ons (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (menu_item_id, add_on_id)
);

create index if not exists idx_category_add_ons_add_on
  on public.category_add_ons (add_on_id);

create index if not exists idx_menu_item_add_ons_add_on
  on public.menu_item_add_ons (add_on_id);

alter table public.category_add_ons enable row level security;
alter table public.menu_item_add_ons enable row level security;

drop policy if exists "public can view category_add_ons" on public.category_add_ons;
create policy "public can view category_add_ons" on public.category_add_ons
  for select using (true);

drop policy if exists "staff can manage category_add_ons" on public.category_add_ons;
create policy "staff can manage category_add_ons" on public.category_add_ons
  for all using (
    exists (
      select 1
      from public.categories c
      where c.id = category_id
        and c.restaurant_id = public.get_my_restaurant_id()
        and public.is_manager_or_owner()
    )
  )
  with check (
    exists (
      select 1
      from public.categories c
      where c.id = category_id
        and c.restaurant_id = public.get_my_restaurant_id()
        and public.is_manager_or_owner()
    )
  );

drop policy if exists "public can view menu_item_add_ons" on public.menu_item_add_ons;
create policy "public can view menu_item_add_ons" on public.menu_item_add_ons
  for select using (true);

drop policy if exists "staff can manage menu_item_add_ons" on public.menu_item_add_ons;
create policy "staff can manage menu_item_add_ons" on public.menu_item_add_ons
  for all using (
    exists (
      select 1
      from public.menu_items m
      where m.id = menu_item_id
        and m.restaurant_id = public.get_my_restaurant_id()
        and public.is_manager_or_owner()
    )
  )
  with check (
    exists (
      select 1
      from public.menu_items m
      where m.id = menu_item_id
        and m.restaurant_id = public.get_my_restaurant_id()
        and public.is_manager_or_owner()
    )
  );

grant select on public.category_add_ons to anon, authenticated;
grant select on public.menu_item_add_ons to anon, authenticated;
grant all on public.category_add_ons to authenticated;
grant all on public.menu_item_add_ons to authenticated;

-- Seed drink placeholders (only when unset)
update public.categories
set special_instructions_placeholder = 'e.g. No sugar, less ice'
where special_instructions_placeholder is null
  and name ~* '(drink|drinks|beverage|cabitaan|cabitaanno|juice|soda|coffee|qaxwo|shaah|smoothie)';

update public.categories
set special_instructions_placeholder = 'e.g. No onions'
where special_instructions_placeholder is null
  and name ~* '(burger|burgers|food|cunno|grill|pizza|main|meal)';

-- Attach existing add-ons to non-drink categories (preserve food options)
insert into public.category_add_ons (category_id, add_on_id)
select c.id, a.id
from public.categories c
join public.add_ons a on a.restaurant_id = c.restaurant_id
where c.name !~* '(drink|drinks|beverage|cabitaan|cabitaanno|juice|soda|coffee|qaxwo|shaah|smoothie)'
on conflict do nothing;

-- Orphan safety: any add-on still unlinked gets attached to ALL categories
-- of its restaurant (edge case: only drink categories exist).
insert into public.category_add_ons (category_id, add_on_id)
select c.id, a.id
from public.add_ons a
join public.categories c on c.restaurant_id = a.restaurant_id
where not exists (
  select 1 from public.category_add_ons ca where ca.add_on_id = a.id
)
on conflict do nothing;
