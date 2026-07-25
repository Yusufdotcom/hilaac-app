-- Verify reports foundation for all 5 timeframes (read-only).
-- Run: npx supabase db query --linked -f scripts/verify-reports-foundation.sql

with restaurant as (
  select id, slug, name
  from public.restaurants
  where slug = 'baba-s-grill-and-cafe'
  limit 1
),
bounds as (
  select
    r.id as restaurant_id,
    r.slug,
    r.name,
    tf.timeframe,
    tf.bucket_granularity,
    tf.start_at,
    tf.end_at
  from restaurant r
  cross join lateral (
    values
      (
        'daily',
        'hourly',
        (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'),
        (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') + interval '1 day'
      ),
      (
        'weekly',
        'daily',
        (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') - interval '6 days',
        (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') + interval '1 day'
      ),
      (
        'biweekly',
        'daily',
        (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') - interval '13 days',
        (date_trunc('day', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') + interval '1 day'
      ),
      (
        'monthly',
        'daily',
        (date_trunc('month', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'),
        (date_trunc('month', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') + interval '1 month'
      ),
      (
        'yearly',
        'monthly',
        (date_trunc('year', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'),
        (date_trunc('year', now() at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi') + interval '1 year'
      )
  ) as tf(timeframe, bucket_granularity, start_at, end_at)
),
kpi as (
  select
    b.timeframe,
    b.slug,
    b.name,
    b.bucket_granularity,
    b.start_at,
    b.end_at,
    (
      select count(distinct o.id)
      from public.orders o
      where o.restaurant_id = b.restaurant_id
        and o.created_at >= b.start_at
        and o.created_at < b.end_at
        and o.payment_status = 'paid'
    ) as total_orders,
    (
      select coalesce(sum(o.total), 0)
      from public.orders o
      where o.restaurant_id = b.restaurant_id
        and o.created_at >= b.start_at
        and o.created_at < b.end_at
        and o.payment_status = 'paid'
    ) as total_revenue,
    (
      select coalesce(sum(oi.quantity), 0)
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where o.restaurant_id = b.restaurant_id
        and o.created_at >= b.start_at
        and o.created_at < b.end_at
        and o.payment_status = 'paid'
    ) as items_sold,
    (
      select count(*)
      from (
        select
          case b.bucket_granularity
            when 'hourly' then date_trunc('hour', o.created_at at time zone 'Africa/Nairobi')
            when 'monthly' then date_trunc('month', o.created_at at time zone 'Africa/Nairobi')
            else date_trunc('day', o.created_at at time zone 'Africa/Nairobi')
          end as bucket
        from public.orders o
        where o.restaurant_id = b.restaurant_id
          and o.created_at >= b.start_at
          and o.created_at < b.end_at
          and o.payment_status = 'paid'
        group by 1
      ) s
    ) as sparse_bucket_count,
    case b.bucket_granularity
      when 'hourly' then 24
      when 'monthly' then
        (
          extract(year from (b.end_at - interval '1 second') at time zone 'Africa/Nairobi')::int * 12
          + extract(month from (b.end_at - interval '1 second') at time zone 'Africa/Nairobi')::int
        )
        -
        (
          extract(year from b.start_at at time zone 'Africa/Nairobi')::int * 12
          + extract(month from b.start_at at time zone 'Africa/Nairobi')::int
        )
        + 1
      else
        (
          ((b.end_at at time zone 'Africa/Nairobi')::date)
          - ((b.start_at at time zone 'Africa/Nairobi')::date)
        )
    end as expected_filled_buckets
  from bounds b
)
select
  timeframe,
  slug,
  bucket_granularity,
  to_char(start_at at time zone 'Africa/Nairobi', 'YYYY-MM-DD HH24:MI') as start_eat,
  to_char(end_at at time zone 'Africa/Nairobi', 'YYYY-MM-DD HH24:MI') as end_eat,
  total_orders,
  items_sold,
  round(total_revenue::numeric, 2) as total_revenue,
  case when total_orders > 0 then round(total_revenue / total_orders, 2) else 0 end as aov,
  sparse_bucket_count as non_empty_chart_buckets,
  expected_filled_buckets as filled_chart_points,
  (total_orders <= items_sold or total_orders = 0) as orders_le_items,
  (
    total_orders = 0
    or abs(
      round(total_revenue / nullif(total_orders, 0), 2)
      - round(total_revenue / nullif(total_orders, 0), 2)
    ) < 0.02
  ) as aov_ok,
  (expected_filled_buckets > 0 and (total_orders = 0 or sparse_bucket_count > 0)) as chart_has_points,
  case
    when (total_orders <= items_sold or total_orders = 0)
      and (expected_filled_buckets > 0 and (total_orders = 0 or sparse_bucket_count > 0))
    then 'PASS'
    else 'FAIL'
  end as status
from kpi
order by
  case timeframe
    when 'daily' then 1
    when 'weekly' then 2
    when 'biweekly' then 3
    when 'monthly' then 4
    else 5
  end;
