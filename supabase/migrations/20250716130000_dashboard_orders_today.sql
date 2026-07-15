-- Dashboard: count of orders placed today (avoids client-side count / timezone mismatches).

create or replace function public.get_dashboard_orders_today(p_restaurant_id uuid)
returns bigint
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  order_count bigint;
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

  select count(o.id)
  into order_count
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= current_date
    and o.created_at < current_date + interval '1 day';

  return coalesce(order_count, 0);
end;
$$;

grant execute on function public.get_dashboard_orders_today(uuid) to authenticated;
