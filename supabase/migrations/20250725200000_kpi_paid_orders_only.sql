-- Unify KPI counting: Total Orders and Total Revenue both use payment_status = 'paid'.
-- Fixes Weekly AOV ($39 / 32 unpaid-inflated orders). Same pattern for all timeframes
-- (only p_start_date / p_end_date change). Aligns Dashboard Orders Today with paid orders.

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
  v_orders bigint;
  v_revenue numeric;
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

  -- Single source of truth: paid orders only (same filter as revenue / charts).
  select
    count(*)::bigint,
    coalesce(sum(o.total), 0)::numeric
  into v_orders, v_revenue
  from public.orders o
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
    coalesce(v_top_qty, 0)::bigint;
end;
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
    and o.created_at < v_end
    and o.payment_status = 'paid';

  return coalesce(order_count, 0);
end;
$$;

grant execute on function public.get_kpi_summary(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_dashboard_orders_today(uuid) to authenticated;
