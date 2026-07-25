-- Temporary paid orders for cross-restaurant reports verification.
-- Marker: notes = '[reports-verify-seed — safe to delete]'
-- Restaurant: hilaac-safari

do $$
declare
  v_restaurant_id uuid;
  v_menu_item_id uuid;
  v_order_id uuid;
  v_now timestamptz := now();
  v_today_start timestamptz :=
    date_trunc('day', v_now at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi';
  i int;
begin
  select id into v_restaurant_id
  from public.restaurants
  where slug = 'hilaac-safari'
  limit 1;

  if v_restaurant_id is null then
    raise exception 'Restaurant hilaac-safari not found';
  end if;

  -- Prefer an existing menu item; otherwise leave menu_item_id null.
  select id into v_menu_item_id
  from public.menu_items
  where restaurant_id = v_restaurant_id
  limit 1;

  -- Clean any previous seed first.
  delete from public.order_items
  where order_id in (
    select id from public.orders
    where restaurant_id = v_restaurant_id
      and notes = '[reports-verify-seed — safe to delete]'
  );
  delete from public.orders
  where restaurant_id = v_restaurant_id
    and notes = '[reports-verify-seed — safe to delete]';

  -- 3 paid orders today (different hours) — 1 item qty each @ $5 → $15, 3 orders, 3 items
  for i in 0..2 loop
    insert into public.orders (
      restaurant_id, table_id, order_type, status, payment_status,
      billing_model, payment_method, total, notes, created_at, updated_at
    ) values (
      v_restaurant_id, null, 'takeaway', 'completed', 'paid',
      'pay_before', 'evc', 5.00,
      '[reports-verify-seed — safe to delete]',
      v_today_start + (make_interval(hours => 10 + i * 2)),
      v_now
    )
    returning id into v_order_id;

    insert into public.order_items (
      order_id, menu_item_id, quantity, price_at_time, notes, add_ons
    ) values (
      v_order_id, v_menu_item_id, 1, 5.00,
      '[reports-verify-seed — safe to delete]',
      '[]'::jsonb
    );
  end loop;

  -- 2 paid orders 3 days ago — one order with qty 2 @ $4 → $8, one qty 1 @ $4 → $4
  -- totals: +2 orders, +3 items, +$12
  insert into public.orders (
    restaurant_id, table_id, order_type, status, payment_status,
    billing_model, payment_method, total, notes, created_at, updated_at
  ) values (
    v_restaurant_id, null, 'takeaway', 'completed', 'paid',
    'pay_before', 'cash', 8.00,
    '[reports-verify-seed — safe to delete]',
    v_today_start - interval '3 days' + interval '14 hours',
    v_now
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, menu_item_id, quantity, price_at_time, notes, add_ons
  ) values (
    v_order_id, v_menu_item_id, 2, 4.00,
    '[reports-verify-seed — safe to delete]',
    '[]'::jsonb
  );

  insert into public.orders (
    restaurant_id, table_id, order_type, status, payment_status,
    billing_model, payment_method, total, notes, created_at, updated_at
  ) values (
    v_restaurant_id, null, 'dine-in', 'delivered', 'paid',
    'pay_before', 'evc', 4.00,
    '[reports-verify-seed — safe to delete]',
    v_today_start - interval '3 days' + interval '18 hours',
    v_now
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, menu_item_id, quantity, price_at_time, notes, add_ons
  ) values (
    v_order_id, v_menu_item_id, 1, 4.00,
    '[reports-verify-seed — safe to delete]',
    '[]'::jsonb
  );

  raise notice 'Seeded 5 paid orders for hilaac-safari (expected daily: 3/$15/3 items; weekly+: 5/$27/6 items)';
end $$;

select
  count(*)::int as seeded_orders,
  coalesce(sum(total), 0)::numeric as seeded_revenue
from public.orders
where notes = '[reports-verify-seed — safe to delete]';
