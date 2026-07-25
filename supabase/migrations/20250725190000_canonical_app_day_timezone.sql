-- Canonical "today" / day boundaries: Africa/Nairobi (EAT, UTC+3, no DST).
-- Matches Hilaac market time and order timestamps stored as +03.
-- Used by Dashboard KPIs so they agree with Reports Daily when both use the same zone.

create or replace function public.app_today_bounds()
returns table (day_start timestamptz, day_end timestamptz)
language sql
stable
set search_path = public
as $$
  select
    ((timezone('Africa/Nairobi', now()))::date)::timestamp
      at time zone 'Africa/Nairobi' as day_start,
    (((timezone('Africa/Nairobi', now()))::date + 1)::timestamp)
      at time zone 'Africa/Nairobi' as day_end;
$$;

create or replace function public.get_dashboard_orders_today(p_restaurant_id uuid)
returns bigint
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  order_count bigint;
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if public.get_my_restaurant_id() is null or public.get_my_restaurant_id() <> p_restaurant_id then
    raise exception 'Forbidden';
  end if;

  if not public.is_manager_or_owner() then
    raise exception 'Forbidden';
  end if;

  select day_start, day_end into v_start, v_end from public.app_today_bounds();

  select count(o.id)
  into order_count
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= v_start
    and o.created_at < v_end;

  return coalesce(order_count, 0);
end;
$$;

create or replace function public.get_dashboard_revenue_today(p_restaurant_id uuid)
returns numeric
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  total_revenue numeric;
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  if public.get_my_restaurant_id() is null or public.get_my_restaurant_id() <> p_restaurant_id then
    raise exception 'Forbidden';
  end if;

  if not public.is_manager_or_owner() then
    raise exception 'Forbidden';
  end if;

  select day_start, day_end into v_start, v_end from public.app_today_bounds();

  select coalesce(sum(o.total), 0)
  into total_revenue
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= v_start
    and o.created_at < v_end
    and o.payment_status = 'paid';

  return total_revenue;
end;
$$;

-- Revenue buckets / peak hours also use Africa/Nairobi calendar days & hours.
create or replace function public.get_revenue_by_period(
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
    to_char(bucket at time zone 'Africa/Nairobi', case p_granularity
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
        when 'monthly' then
          date_trunc('month', o.created_at at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'
        when 'yearly' then
          date_trunc('year', o.created_at at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'
        when 'weekly' then
          date_trunc('week', o.created_at at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'
        else
          date_trunc('day', o.created_at at time zone 'Africa/Nairobi') at time zone 'Africa/Nairobi'
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

grant execute on function public.app_today_bounds() to authenticated;
grant execute on function public.get_dashboard_orders_today(uuid) to authenticated;
grant execute on function public.get_dashboard_revenue_today(uuid) to authenticated;
grant execute on function public.get_revenue_by_period(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.get_peak_hours(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_peak_days(uuid, timestamptz, timestamptz) to authenticated;
