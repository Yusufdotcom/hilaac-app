-- Multi-location (branch) support for Pro plan owners.

alter table public.restaurants
  add column if not exists branch_name text;

comment on column public.restaurants.branch_name is 'Optional display label for a branch location; falls back to name.';

-- Owners can list and manage every restaurant they own (for branch selector + settings).
drop policy if exists "owners can view own restaurants" on public.restaurants;
create policy "owners can view own restaurants" on public.restaurants
  for select using (owner_id = auth.uid());

drop policy if exists "owners can insert own restaurants" on public.restaurants;
create policy "owners can insert own restaurants" on public.restaurants
  for insert with check (owner_id = auth.uid() and public.get_my_role() = 'owner');

drop policy if exists "owners can update own restaurants" on public.restaurants;
create policy "owners can update own restaurants" on public.restaurants
  for update using (owner_id = auth.uid() and public.get_my_role() = 'owner');

grant select (owner_id, branch_name) on public.restaurants to anon, authenticated;
