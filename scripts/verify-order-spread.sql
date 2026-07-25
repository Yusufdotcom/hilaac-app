with r as (select id from restaurants where slug = 'baba-s-grill-and-cafe')
select
  (o.created_at at time zone 'Africa/Nairobi')::date::text as day_eat,
  count(*)::int as paid_orders
from orders o, r
where o.restaurant_id = r.id
  and o.payment_status = 'paid'
group by 1
order by 1;
