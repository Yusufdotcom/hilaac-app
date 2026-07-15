-- Staff (authenticated) need explicit table grants; RLS policies scope by restaurant_id.
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
