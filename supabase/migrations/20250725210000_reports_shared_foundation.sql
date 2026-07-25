-- Shared reports foundation:
-- 1) Order counts always COUNT(DISTINCT order id) from orders (never joined fanout)
-- 2) Revenue KPIs from orders.total (order source of truth); item qty from order_items
-- 3) get_revenue_by_period supports hourly | daily | weekly | monthly | yearly buckets
-- 4) KPI returns items_sold for orders <= items sanity check

drop function if exists public.get_kpi_summary(uuid, timestamptz, timestamptz);

create function public.get_kpi_summary(
  p_restaurant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns table (
  total_orders bigint,
  total_revenue numeric,
  avg_order_value numeric,
  top_item_name text,
  top_item_quantity bigint,
  items_sold bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_top_name text;
  v_top_qty bigint;
  v_orders bigint;
  v_revenue numeric;
  v_items bigint;
begin
  perform public.assert_reports_access(p_restaurant_id);

  select t.item_name, t.quantity_sold
  into v_top_name, v_top_qty
  from public.get_top_items(p_restaurant_id, p_start_date, p_end_date, 1) t
  limit 1;

  if v_top_qty is null or v_top_qty <= 0 then
    v_top_name := null;
    v_top_qty := 0;
  end if;

  -- ONE pattern for all timeframes: paid orders only, distinct order rows.
  select
    count(distinct o.id)::bigint,
    coalesce(sum(o.total), 0)::numeric
  into v_orders, v_revenue
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_start_date
    and o.created_at < p_end_date
    and o.payment_status = 'paid';

  select coalesce(sum(oi.quantity), 0)::bigint
  into v_items
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_start_date
    and o.created_at < p_end_date
    and o.payment_status = 'paid';

  return query
  select
    coalesce(v_orders, 0)::bigint,
    coalesce(v_revenue, 0)::numeric,
    case
      when coalesce(v_orders, 0) > 0 then round(coalesce(v_revenue, 0) / v_orders, 2)
      else 0::numeric
    end,
    v_top_name,
    coalesce(v_top_qty, 0)::bigint,
    coalesce(v_items, 0)::bigint;
end;
$$;

drop function if exists public.get_revenue_by_period(uuid, timestamptz, timestamptz, text);

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
    s.bucket,
    case p_granularity
      when 'hourly' then to_char(s.bucket at time zone 'Africa/Nairobi', 'HH24:00')
      when 'monthly' then to_char(s.bucket at time zone 'Africa/Nairobi', 'Mon YYYY')
      when 'yearly' then to_char(s.bucket at time zone 'Africa/Nairobi', 'YYYY')
      when 'weekly' then to_char(s.bucket at time zone 'Africa/Nairobi', 'Mon DD')
      else to_char(s.bucket at time zone 'Africa/Nairobi', 'Mon DD')
    end,
    s.cnt,
    s.rev
  from (
    select
      case p_granularity
        when 'hourly' then
          date_trunc('hour', o.created_at at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'
        when 'monthly' then
          date_trunc('month', o.created_at at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'
        when 'yearly' then
          date_trunc('year', o.created_at at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'
        when 'weekly' then
          date_trunc('week', o.created_at at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'
        else
          date_trunc('day', o.created_at at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'
      end as bucket,
      count(distinct o.id)::bigint as cnt,
      coalesce(sum(o.total), 0)::numeric as rev
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.created_at >= p_start_date
      and o.created_at < p_end_date
      and o.payment_status = 'paid'
    group by 1
  ) s
  order by s.bucket;
end;
$$;

-- Harden other order-count RPCs to COUNT(DISTINCT id) for consistency.
create or replace function public.get_payment_split(
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
      count(distinct o.id)::bigint as order_count,
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
    coalesce(s.order_count, 0)::bigint,
    coalesce(s.revenue, 0)::numeric
  from methods m
  left join stats s on s.payment_method = m.payment_method
  order by 3 desc, m.payment_method;
end;
$$;

create or replace function public.get_peak_hours(
  p_restaurant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns table (
  hour_of_day int,
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
    h.hour_of_day::int,
    coalesce(stats.cnt, 0)::bigint,
    coalesce(stats.rev, 0)::numeric
  from generate_series(0, 23) as h(hour_of_day)
  left join (
    select
      extract(hour from o.created_at at time zone 'Africa/Nairobi')::int as hr,
      count(distinct o.id)::bigint as cnt,
      coalesce(sum(o.total), 0)::numeric as rev
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.created_at >= p_start_date
      and o.created_at < p_end_date
      and o.payment_status = 'paid'
    group by 1
  ) stats on stats.hr = h.hour_of_day
  order by h.hour_of_day;
end;
$$;

create or replace function public.get_peak_days(
  p_restaurant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
returns table (
  day_of_week int,
  day_label text,
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
    d.dow::int,
    case d.dow
      when 0 then 'Sunday'
      when 1 then 'Monday'
      when 2 then 'Tuesday'
      when 3 then 'Wednesday'
      when 4 then 'Thursday'
      when 5 then 'Friday'
      else 'Saturday'
    end,
    coalesce(stats.cnt, 0)::bigint,
    coalesce(stats.rev, 0)::numeric
  from generate_series(0, 6) as d(dow)
  left join (
    select
      extract(dow from o.created_at at time zone 'Africa/Nairobi')::int as dow,
      count(distinct o.id)::bigint as cnt,
      coalesce(sum(o.total), 0)::numeric as rev
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.created_at >= p_start_date
      and o.created_at < p_end_date
      and o.payment_status = 'paid'
    group by 1
  ) stats on stats.dow = d.dow
  order by d.dow;
end;
$$;

create or replace function public.get_waiter_performance(
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
    trim(o.delivered_by)::text,
    count(distinct o.id)::bigint,
    coalesce(sum(o.total), 0)::numeric
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_start_date
    and o.created_at < p_end_date
    and o.status in ('delivered', 'completed')
    and o.delivered_by is not null
    and trim(o.delivered_by) <> ''
  group by trim(o.delivered_by)
  order by 2 desc;
end;
$$;

grant execute on function public.get_kpi_summary(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_revenue_by_period(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.get_payment_split(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_peak_hours(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_peak_days(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_waiter_performance(uuid, timestamptz, timestamptz) to authenticated;
