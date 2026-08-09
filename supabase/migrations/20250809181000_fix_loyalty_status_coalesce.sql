-- Fix loyalty credit trigger: coalesce(old.status, '') casts '' to order_status and
-- breaks any status UPDATE (including cancel → cancelled) with 22P02.

create or replace function public.trg_orders_credit_loyalty()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.status in ('delivered', 'completed')
     and (old.status is distinct from new.status)
     and old.status not in ('delivered', 'completed') then
    perform public.credit_loyalty_for_order(new.id);
  end if;
  return new;
end;
$$;
