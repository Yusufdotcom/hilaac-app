-- Dashboard: today's paid revenue (avoids PostgREST aggregate restrictions).

create or replace function public.get_dashboard_revenue_today(p_restaurant_id uuid)
returns numeric
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  total_revenue numeric;
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

  select coalesce(sum(o.total), 0)
  into total_revenue
  from public.orders o
  where o.restaurant_id = p_restaurant_id
    and o.created_at >= current_date
    and o.created_at < current_date + interval '1 day'
    and o.payment_status = 'paid';

  return total_revenue;
end;
$$;

grant execute on function public.get_dashboard_revenue_today(uuid) to authenticated;
