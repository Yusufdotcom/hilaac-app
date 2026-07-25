-- Align KPI order counting with Dashboard "Orders Today":
-- count all orders in the window; revenue remains paid-only (like Revenue Today).
-- AOV = total_revenue / total_orders when total_orders > 0.

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

  -- Orders: all statuses in range (matches get_dashboard_orders_today).
  select count(*)::bigint
  into v_orders
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_start_date
    and o.created_at < p_end_date;

  -- Revenue: paid only (matches get_dashboard_revenue_today).
  select coalesce(sum(o.total), 0)::numeric
  into v_revenue
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

grant execute on function public.get_kpi_summary(uuid, timestamptz, timestamptz) to authenticated;
