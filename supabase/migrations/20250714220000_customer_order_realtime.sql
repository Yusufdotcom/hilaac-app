-- Allow anonymous customers to receive Realtime updates for recent orders.
-- Column grants match GET /api/orders/[id]/track (no customer_phone or notes).

drop policy if exists "customers can track recent orders" on public.orders;
create policy "customers can track recent orders"
  on public.orders
  for select
  to anon
  using (created_at >= (now() - interval '7 days'));

revoke all on public.orders from anon;
grant select (
  id, status, payment_status, order_type, total, created_at
) on public.orders to anon;
