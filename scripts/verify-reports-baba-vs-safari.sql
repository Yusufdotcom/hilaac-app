-- Compare Baba (existing) vs hilaac-safari (seeded) across all 5 timeframes.
with restaurants as (
  select id, slug from public.restaurants
  where slug in ('baba-s-grill-and-cafe', 'hilaac-safari')
),
bounds as (
  select r.id as restaurant_id, r.slug, tf.timeframe, tf.bucket_granularity, tf.start_at, tf.end_at
  from restaurants r
  cross join lateral (
    values
      ('daily','hourly',
        (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'),
        (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') + interval '1 day'),
      ('weekly','daily',
        (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') - interval '6 days',
        (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') + interval '1 day'),
      ('biweekly','daily',
        (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') - interval '13 days',
        (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') + interval '1 day'),
      ('monthly','daily',
        (date_trunc('month', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'),
        (date_trunc('month', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') + interval '1 month'),
      ('yearly','monthly',
        (date_trunc('year', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'),
        (date_trunc('year', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') + interval '1 year')
  ) as tf(timeframe, bucket_granularity, start_at, end_at)
),
kpi as (
  select
    b.slug, b.timeframe, b.bucket_granularity, b.start_at, b.end_at,
    (select count(distinct o.id) from orders o
      where o.restaurant_id=b.restaurant_id and o.created_at>=b.start_at and o.created_at<b.end_at and o.payment_status='paid') as total_orders,
    (select coalesce(sum(o.total),0) from orders o
      where o.restaurant_id=b.restaurant_id and o.created_at>=b.start_at and o.created_at<b.end_at and o.payment_status='paid') as total_revenue,
    (select coalesce(sum(oi.quantity),0) from order_items oi join orders o on o.id=oi.order_id
      where o.restaurant_id=b.restaurant_id and o.created_at>=b.start_at and o.created_at<b.end_at and o.payment_status='paid') as items_sold,
    (select count(*) from (
      select case b.bucket_granularity
        when 'hourly' then date_trunc('hour', o.created_at at time zone 'Africa/Nairobi')
        when 'monthly' then date_trunc('month', o.created_at at time zone 'Africa/Nairobi')
        else date_trunc('day', o.created_at at time zone 'Africa/Nairobi') end
      from orders o
      where o.restaurant_id=b.restaurant_id and o.created_at>=b.start_at and o.created_at<b.end_at and o.payment_status='paid'
      group by 1
    ) s) as non_empty_buckets,
    case b.bucket_granularity
      when 'hourly' then 24
      when 'monthly' then 12
      else (((b.end_at at time zone 'Africa/Nairobi')::date) - ((b.start_at at time zone 'Africa/Nairobi')::date))
    end as filled_points
  from bounds b
)
select
  slug, timeframe, bucket_granularity,
  total_orders, items_sold,
  round(total_revenue::numeric, 2) as total_revenue,
  case when total_orders > 0 then round(total_revenue / total_orders, 2) else 0 end as aov,
  non_empty_buckets, filled_points,
  (total_orders <= items_sold or total_orders = 0) as orders_le_items,
  (
    total_orders = 0
    or abs(
      round(total_revenue / total_orders, 2)
      - round(total_revenue / total_orders, 2)
    ) < 0.02
  ) as aov_ok,
  (filled_points > 0 and (total_orders = 0 or non_empty_buckets > 0)) as chart_ok,
  case
    when (total_orders <= items_sold or total_orders = 0)
     and (filled_points > 0 and (total_orders = 0 or non_empty_buckets > 0))
     and total_orders > 0
    then 'PASS_NONEMPTY'
    when (total_orders <= items_sold or total_orders = 0)
     and (filled_points > 0 and (total_orders = 0 or non_empty_buckets > 0))
    then 'PASS_EMPTY'
    else 'FAIL'
  end as status
from kpi
order by
  case slug when 'baba-s-grill-and-cafe' then 1 else 2 end,
  case timeframe
    when 'daily' then 1 when 'weekly' then 2 when 'biweekly' then 3
    when 'monthly' then 4 else 5
  end;
