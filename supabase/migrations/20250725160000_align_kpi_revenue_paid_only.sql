-- Align KPI summary with revenue chart:
-- both must use the same date bounds and payment_status = 'paid'.
-- Remote had a divergent get_kpi_summary that summed ALL orders (incl. pending),
-- which made Total Revenue >> chart peaks that only include paid orders.

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
    case
      when count(*) > 0 then round(coalesce(sum(o.total), 0) / count(*), 2)
      else 0::numeric
    end as avg_order_value,
    coalesce(v_top_name, '—') as top_item_name,
    coalesce(v_top_qty, 0)::bigint as top_item_quantity
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= p_start_date
    and o.created_at < p_end_date
    and o.payment_status = 'paid';
end;
$$;

grant execute on function public.get_kpi_summary(uuid, timestamptz, timestamptz) to authenticated;

-- Ensure revenue-by-period grants still exist after earlier drop/recreate.
grant execute on function public.get_revenue_by_period(uuid, timestamptz, timestamptz, text) to authenticated;
grant execute on function public.get_least_ordered_items(uuid, timestamptz, timestamptz, int) to authenticated;
grant execute on function public.get_payment_split(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_waiter_performance(uuid, timestamptz, timestamptz) to authenticated;
