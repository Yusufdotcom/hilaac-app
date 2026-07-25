-- Align ALL reports RPCs to the same date window + payment_status = 'paid'.
-- Drop/recreate so OUT column types and names match the app.

drop function if exists public.get_kpi_summary(uuid, timestamptz, timestamptz);
drop function if exists public.get_top_items(uuid, timestamptz, timestamptz, int);
drop function if exists public.get_least_ordered_items(uuid, timestamptz, timestamptz, int);
drop function if exists public.get_peak_hours(uuid, timestamptz, timestamptz);
drop function if exists public.get_peak_days(uuid, timestamptz, timestamptz);
drop function if exists public.get_payment_split(uuid, timestamptz, timestamptz);
drop function if exists public.get_revenue_by_period(uuid, timestamptz, timestamptz, text);
drop function if exists public.get_waiter_performance(uuid, timestamptz, timestamptz);

-- Create get_top_items first (get_kpi_summary depends on it).
create function public.get_top_items(
  p_restaurant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_limit int default 10
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
    coalesce(mi.name, 'Unknown item')::text,
    coalesce(sum(oi.quantity), 0)::bigint,
    coalesce(sum(oi.quantity * oi.price_at_time), 0)::numeric
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.menu_items mi on mi.id = oi.menu_item_id
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_start_date
    and o.created_at < p_end_date
    and o.payment_status = 'paid'
  group by coalesce(mi.name, 'Unknown item')
  having coalesce(sum(oi.quantity), 0) > 0
  order by 2 desc
  limit greatest(p_limit, 1);
end;
$$;

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
  top_item_quantity bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_top_name text;
  v_top_qty bigint;
begin
  perform public.assert_reports_access(p_restaurant_id);

  select t.item_name, t.quantity_sold
  into v_top_name, v_top_qty
  from public.get_top_items(p_restaurant_id, p_start_date, p_end_date, 1) t
  limit 1;

  -- Only return a top item when it was actually sold in this timeframe.
  if v_top_qty is null or v_top_qty <= 0 then
    v_top_name := null;
    v_top_qty := 0;
  end if;

  return query
  select
    count(*)::bigint,
    coalesce(sum(o.total), 0)::numeric,
    case
      when count(*) > 0 then round(coalesce(sum(o.total), 0) / count(*), 2)
      else 0::numeric
    end,
    v_top_name,
    coalesce(v_top_qty, 0)::bigint
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_start_date
    and o.created_at < p_end_date
    and o.payment_status = 'paid';
end;
$$;

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
    bucket,
    to_char(bucket, case p_granularity
      when 'monthly' then 'Mon YYYY'
      when 'yearly' then 'YYYY'
      when 'weekly' then 'Mon DD'
      else 'Mon DD'
    end),
    count(*)::bigint,
    coalesce(sum(o.total), 0)::numeric
  from (
    select
      o.total,
      case p_granularity
        when 'monthly' then date_trunc('month', o.created_at)
        when 'yearly' then date_trunc('year', o.created_at)
        when 'weekly' then date_trunc('week', o.created_at)
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
    coalesce(mi.name, 'Unknown item')::text,
    coalesce(sum(oi.quantity), 0)::bigint,
    coalesce(sum(oi.quantity * oi.price_at_time), 0)::numeric
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

create function public.get_peak_hours(
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
      extract(hour from o.created_at)::int as hr,
      count(*)::bigint as cnt,
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

-- Day-of-week traffic for Peak Days insight (0 = Sunday … 6 = Saturday).
create function public.get_peak_days(
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
      extract(dow from o.created_at)::int as dow,
      count(*)::bigint as cnt,
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
    coalesce(s.order_count, 0)::bigint,
    coalesce(s.revenue, 0)::numeric
  from methods m
  left join stats s on s.payment_method = m.payment_method
  order by 3 desc, m.payment_method;
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
    trim(o.delivered_by)::text,
    count(*)::bigint,
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
grant execute on function public.get_top_items(uuid, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.get_least_ordered_items(uuid, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.get_peak_hours(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_peak_days(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_payment_split(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_waiter_performance(uuid, timestamptz, timestamptz) to authenticated;
