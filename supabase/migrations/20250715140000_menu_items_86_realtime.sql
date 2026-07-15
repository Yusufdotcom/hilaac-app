-- Allow customers to see 86'd items (greyed out) on active restaurant menus.
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

-- Enable realtime availability updates for customer + kitchen screens.
alter publication supabase_realtime add table public.menu_items;
