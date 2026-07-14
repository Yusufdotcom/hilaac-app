-- Allow customers to mark their own pending USSD orders as paid (payment_status only).

drop policy if exists "customers can confirm payment on recent orders" on public.orders;
create policy "customers can confirm payment on recent orders"
  on public.orders
  for update
  to anon
  using (
    created_at >= (now() - interval '7 days')
    and payment_status = 'pending'
  )
  with check (
    created_at >= (now() - interval '7 days')
    and payment_status = 'paid'
  );

grant update (payment_status) on public.orders to anon;
