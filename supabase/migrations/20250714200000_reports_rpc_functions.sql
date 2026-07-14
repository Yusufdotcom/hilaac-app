-- Reporting & Analytics RPC functions (scoped by restaurant + date range)

create or replace function public.assert_reports_access(p_restaurant_id uuid)
returns void
language plpgsql
security definer
stable
set search_path = public
as $$
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
end;
$$;

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
    bucket as period_start,
    to_char(bucket, case p_granularity
      when 'monthly' then 'Mon YYYY'
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

create or replace function public.get_top_items(
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
    coalesce(mi.name, 'Unknown item') as item_name,
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
  order by quantity_sold desc
  limit greatest(p_limit, 1);
end;
$$;

create or replace function public.get_least_ordered_items(
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
    coalesce(mi.name, 'Unknown item') as item_name,
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
  order by quantity_sold asc
  limit greatest(p_limit, 1);
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
    h.hour_of_day,
    coalesce(stats.order_count, 0)::bigint as order_count,
    coalesce(stats.revenue, 0)::numeric as revenue
  from generate_series(0, 23) as h(hour_of_day)
  left join (
    select
      extract(hour from o.created_at at time zone 'UTC')::int as hour_of_day,
      count(*)::bigint as order_count,
      coalesce(sum(o.total), 0)::numeric as revenue
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.created_at >= p_start_date
      and o.created_at < p_end_date
      and o.payment_status = 'paid'
    group by extract(hour from o.created_at at time zone 'UTC')::int
  ) stats on stats.hour_of_day = h.hour_of_day
  order by h.hour_of_day;
end;
$$;

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
  select
    case
      when o.payment_method is null then 'Cash'
      else upper(o.payment_method::text)
    end as payment_method,
    count(*)::bigint as order_count,
    coalesce(sum(o.total), 0)::numeric as revenue
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_start_date
    and o.created_at < p_end_date
    and o.payment_status = 'paid'
  group by case
    when o.payment_method is null then 'Cash'
    else upper(o.payment_method::text)
  end
  order by revenue desc;
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
    coalesce(nullif(trim(o.delivered_by), ''), 'Unassigned') as waiter_name,
    count(*)::bigint as deliveries,
    coalesce(sum(o.total), 0)::numeric as revenue
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_start_date
    and o.created_at < p_end_date
    and o.status = 'completed'
  group by coalesce(nullif(trim(o.delivered_by), ''), 'Unassigned')
  order by deliveries desc;
end;
$$;

create or replace function public.get_kpi_summary(
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

  return query
  select
    count(*)::bigint as total_orders,
    coalesce(sum(o.total), 0)::numeric as total_revenue,
    case when count(*) > 0 then round(coalesce(sum(o.total), 0) / count(*), 2) else 0 end as avg_order_value,
    coalesce(v_top_name, '—') as top_item_name,
    coalesce(v_top_qty, 0)::bigint as top_item_quantity
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_start_date
    and o.created_at < p_end_date
    and o.payment_status = 'paid';
end;
$$;

grant execute on function public.assert_reports_access(uuid) to authenticated;
grant execute on function public.get_revenue_by_period(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.get_top_items(uuid, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.get_least_ordered_items(uuid, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.get_peak_hours(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_payment_split(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_waiter_performance(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_kpi_summary(uuid, timestamptz, timestamptz) to authenticated;
