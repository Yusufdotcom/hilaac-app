-- Remove temporary reports verification seed.
delete from public.order_items
where order_id in (
  select id from public.orders
  where notes = '[reports-verify-seed — safe to delete]'
);

delete from public.orders
where notes = '[reports-verify-seed — safe to delete]';

select
  (select count(*) from public.orders where notes = '[reports-verify-seed — safe to delete]')::int as remaining_seed_orders;
