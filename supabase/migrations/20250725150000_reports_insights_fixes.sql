-- Insights fixes:
-- 1) Payment split always returns EVC / eDahab / Cash (0 when unused)
-- 2) Waiter performance includes delivered + completed (not only completed)
-- 3) Revenue by period supports yearly buckets
-- 4) Least-ordered returns explicit coalesced quantity_sold
--
-- Drop first: CREATE OR REPLACE cannot change OUT/return row types.

drop function if exists public.get_revenue_by_period(uuid, timestamptz, timestamptz, text);
drop function if exists public.get_least_ordered_items(uuid, timestamptz, timestamptz, int);
drop function if exists public.get_payment_split(uuid, timestamptz, timestamptz);
drop function if exists public.get_waiter_performance(uuid, timestamptz, timestamptz);

create function public.get_revenue_by_period(
  p_restaurant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_granularity text default 'daily'
)
returns table (
  period_start timestamptz,
  period_label text,
  order_count bigint,
  revenue numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  perform public.assert_reports_access(p_restaurant_id);

  return query
  select
    bucket as period_start,
    to_char(bucket, case p_granularity
      when 'monthly' then 'Mon YYYY'
      when 'yearly' then 'YYYY'
      when 'weekly' then 'Mon DD'
      when 'biweekly' then 'Mon DD'
      else 'Mon DD'
    end) as period_label,
    count(*)::bigint as order_count,
    coalesce(sum(o.total), 0)::numeric as revenue
  from (
    select
      o.*,
      case p_granularity
        when 'monthly' then date_trunc('month', o.created_at)
        when 'yearly' then date_trunc('year', o.created_at)
        when 'weekly' then date_trunc('week', o.created_at)
        when 'biweekly' then p_start_date + (
          floor(extract(epoch from (o.created_at - p_start_date)) / (14 * 86400)) * interval '14 days'
        )
        else date_trunc('day', o.created_at)
      end as bucket
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.created_at >= p_start_date
      and o.created_at < p_end_date
      and o.payment_status = 'paid'
  ) o
  group by bucket
  order by bucket;
end;
$$;

create function public.get_least_ordered_items(
  p_restaurant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit int default 5
)
returns table (
  item_name text,
  quantity_sold bigint,
  revenue numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  perform public.assert_reports_access(p_restaurant_id);

  return query
  select
    coalesce(mi.name, 'Unknown item')::text as item_name,
    coalesce(sum(oi.quantity), 0)::bigint as quantity_sold,
    coalesce(sum(oi.quantity * oi.price_at_time), 0)::numeric as revenue
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.menu_items mi on mi.id = oi.menu_item_id
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_start_date
    and o.created_at < p_end_date
    and o.payment_status = 'paid'
  group by coalesce(mi.name, 'Unknown item')
  having coalesce(sum(oi.quantity), 0) > 0
  order by 2 asc
  limit greatest(p_limit, 1);
end;
$$;

create function public.get_payment_split(
  p_restaurant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns table (
  payment_method text,
  order_count bigint,
  revenue numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  perform public.assert_reports_access(p_restaurant_id);

  return query
  with methods as (
    select unnest(array['EVC', 'EDAHAB', 'CASH']) as payment_method
  ),
  stats as (
    select
      case
        when o.payment_method is null then 'CASH'
        when lower(o.payment_method::text) in ('evc') then 'EVC'
        when lower(o.payment_method::text) in ('edahab', 'e-dahab') then 'EDAHAB'
        else upper(o.payment_method::text)
      end as payment_method,
      count(*)::bigint as order_count,
      coalesce(sum(o.total), 0)::numeric as revenue
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.created_at >= p_start_date
      and o.created_at < p_end_date
      and o.payment_status = 'paid'
    group by 1
  )
  select
    m.payment_method,
    coalesce(s.order_count, 0)::bigint as order_count,
    coalesce(s.revenue, 0)::numeric as revenue
  from methods m
  left join stats s on s.payment_method = m.payment_method
  order by coalesce(s.revenue, 0) desc, m.payment_method;
end;
$$;

create function public.get_waiter_performance(
  p_restaurant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns table (
  waiter_name text,
  deliveries bigint,
  revenue numeric
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  perform public.assert_reports_access(p_restaurant_id);

  return query
  select
    trim(o.delivered_by)::text as waiter_name,
    count(*)::bigint as deliveries,
    coalesce(sum(o.total), 0)::numeric as revenue
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_start_date
    and o.created_at < p_end_date
    and o.status in ('delivered', 'completed')
    and o.delivered_by is not null
    and trim(o.delivered_by) <> ''
  group by trim(o.delivered_by)
  order by deliveries desc;
end;
$$;
