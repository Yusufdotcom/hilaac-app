-- Return a sentinel row when there are no paid orders in the date range
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

  if not exists (
    select 1
    from public.orders o
    where o.restaurant_id = p_restaurant_id
      and o.created_at >= p_start_date
      and o.created_at < p_end_date
      and o.payment_status = 'paid'
  ) then
    return query select 'no_orders'::text, 0::bigint, 0::numeric;
    return;
  end if;

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
