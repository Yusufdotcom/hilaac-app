-- Insights verification against raw paid orders (mirrors RPC filters, skips auth guard).
-- Run: npx supabase db query --linked -f scripts/verify-report-insights.sql

with rest as (
  select id, name from restaurants where slug = 'baba-s-grill-and-cafe' limit 1
),
bounds as (
  select
    (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') as today_start,
    ((date_trunc('day', now() at time zone 'Africa/Nairobi') + interval '1 day')
      at time zone 'Africa/Nairobi') as today_end
),
weekly as (
  select
    (b.today_start - interval '6 days') as start_at,
    b.today_end as end_at,
    (b.today_start - interval '13 days') as prev_start,
    (b.today_start - interval '6 days') as prev_end,
    (b.today_start - interval '13 days') as r14_start,
    b.today_end as r14_end,
    (b.today_start - interval '43 days') as p30_start,
    (b.today_start - interval '13 days') as p30_end
  from bounds b
),
cur_items as (
  select coalesce(mi.name, 'Unknown item') as item_name, sum(oi.quantity)::bigint as quantity_sold
  from order_items oi
  join orders o on o.id = oi.order_id
  left join menu_items mi on mi.id = oi.menu_item_id
  where o.restaurant_id = (select id from rest)
    and o.payment_status = 'paid'
    and o.created_at >= (select start_at from weekly)
    and o.created_at < (select end_at from weekly)
  group by 1
  having sum(oi.quantity) > 0
),
prev_items as (
  select coalesce(mi.name, 'Unknown item') as item_name, sum(oi.quantity)::bigint as quantity_sold
  from order_items oi
  join orders o on o.id = oi.order_id
  left join menu_items mi on mi.id = oi.menu_item_id
  where o.restaurant_id = (select id from rest)
    and o.payment_status = 'paid'
    and o.created_at >= (select prev_start from weekly)
    and o.created_at < (select prev_end from weekly)
  group by 1
  having sum(oi.quantity) > 0
),
r14_items as (
  select coalesce(mi.name, 'Unknown item') as item_name, sum(oi.quantity)::bigint as quantity_sold
  from order_items oi
  join orders o on o.id = oi.order_id
  left join menu_items mi on mi.id = oi.menu_item_id
  where o.restaurant_id = (select id from rest)
    and o.payment_status = 'paid'
    and o.created_at >= (select r14_start from weekly)
    and o.created_at < (select r14_end from weekly)
  group by 1
  having sum(oi.quantity) > 0
),
p30_items as (
  select coalesce(mi.name, 'Unknown item') as item_name, sum(oi.quantity)::bigint as quantity_sold
  from order_items oi
  join orders o on o.id = oi.order_id
  left join menu_items mi on mi.id = oi.menu_item_id
  where o.restaurant_id = (select id from rest)
    and o.payment_status = 'paid'
    and o.created_at >= (select p30_start from weekly)
    and o.created_at < (select p30_end from weekly)
  group by 1
  having sum(oi.quantity) > 0
),
trending as (
  select
    c.item_name,
    c.quantity_sold as current_qty,
    p.quantity_sold as previous_qty,
    round(((c.quantity_sold - p.quantity_sold)::numeric / p.quantity_sold) * 100, 1) as growth_pct
  from cur_items c
  join prev_items p on p.item_name = c.item_name
  where c.quantity_sold >= 5
    and p.quantity_sold > 0
    and ((c.quantity_sold - p.quantity_sold)::numeric / p.quantity_sold) * 100 >= 25
  order by growth_pct desc
),
under as (
  select p.item_name, p.quantity_sold as prior30_qty
  from p30_items p
  where p.quantity_sold >= 5
    and not exists (select 1 from r14_items r where r.item_name = p.item_name)
  order by p.quantity_sold desc
  limit 3
),
rev as (
  select
    coalesce(sum(o.total) filter (
      where o.created_at >= (select start_at from weekly)
        and o.created_at < (select end_at from weekly)
    ), 0) as current_rev,
    coalesce(sum(o.total) filter (
      where o.created_at >= (select prev_start from weekly)
        and o.created_at < (select prev_end from weekly)
    ), 0) as previous_rev
  from orders o
  where o.restaurant_id = (select id from rest)
    and o.payment_status = 'paid'
),
peak as (
  select
    extract(hour from o.created_at at time zone 'Africa/Nairobi')::int as hour_of_day,
    count(distinct o.id)::bigint as order_count
  from orders o
  where o.restaurant_id = (select id from rest)
    and o.payment_status = 'paid'
    and o.created_at >= (select start_at from weekly)
    and o.created_at < (select end_at from weekly)
  group by 1
),
peak_total as (
  select coalesce(sum(order_count), 0)::numeric as total from peak
),
peak_block as (
  select
    a.hour_of_day as start_hour,
    a.hour_of_day + 2 as end_hour,
    (a.order_count + coalesce(b.order_count, 0)) as block_orders,
    case when t.total > 0
      then round(((a.order_count + coalesce(b.order_count, 0)) / t.total) * 100, 1)
      else 0 end as share_pct
  from peak a
  left join peak b on b.hour_of_day = a.hour_of_day + 1
  cross join peak_total t
  where a.hour_of_day < 23
  order by block_orders desc
  limit 1
),
pay as (
  select
    case
      when o.payment_method is null then 'CASH'
      when lower(o.payment_method::text) in ('evc') then 'EVC'
      when lower(o.payment_method::text) in ('edahab', 'e-dahab') then 'EDAHAB'
      else upper(o.payment_method::text)
    end as payment_method,
    count(distinct o.id)::bigint as order_count
  from orders o
  where o.restaurant_id = (select id from rest)
    and o.payment_status = 'paid'
    and o.created_at >= (select start_at from weekly)
    and o.created_at < (select end_at from weekly)
  group by 1
),
pay_total as (select coalesce(sum(order_count), 0)::numeric as total from pay),
pay_top as (
  select
    payment_method,
    order_count,
    case when t.total > 0 then round((order_count / t.total) * 100, 1) else 0 end as share_pct
  from pay
  cross join pay_total t
  order by order_count desc
  limit 1
)
select 'restaurant' as section, to_jsonb(r) as detail from rest r
union all
select 'windows', jsonb_build_object(
  'weekly_start', (select start_at from weekly),
  'weekly_end', (select end_at from weekly),
  'prev_start', (select prev_start from weekly),
  'prev_end', (select prev_end from weekly)
)
union all
select 'revenue_trend', jsonb_build_object(
  'current', (select current_rev from rev),
  'previous', (select previous_rev from rev),
  'pct', case
    when (select previous_rev from rev) > 0 then
      round((((select current_rev from rev) - (select previous_rev from rev))
        / (select previous_rev from rev)) * 100, 1)
    else null
  end
)
union all
select 'trending_up', coalesce((select jsonb_agg(to_jsonb(t)) from trending t), '[]'::jsonb)
union all
select 'underperforming', coalesce((select jsonb_agg(to_jsonb(u)) from under u), '[]'::jsonb)
union all
select 'peak_hours', coalesce((select to_jsonb(pb) from peak_block pb), '{}'::jsonb)
union all
select 'payment', coalesce((select to_jsonb(pt) from pay_top pt), '{}'::jsonb);
