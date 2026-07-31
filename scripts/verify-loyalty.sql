-- Loyalty smoke check: phone normalize + cross-restaurant scoping.
-- npx supabase db query --linked -f scripts/verify-loyalty.sql

select
  public.normalize_loyalty_phone('0612345678') as from_local,
  public.normalize_loyalty_phone('+252612345678') as from_e164;

insert into loyalty_settings (restaurant_id, enabled, target_order_count, reward_description)
select id, true, 3, 'Free Delish Burg'
from restaurants
where slug = 'baba-s-grill-and-cafe'
on conflict (restaurant_id) do update
set enabled = excluded.enabled,
    target_order_count = excluded.target_order_count,
    reward_description = excluded.reward_description;

insert into loyalty_settings (restaurant_id, enabled, target_order_count, reward_description)
select id, true, 5, 'Safari free drink'
from restaurants
where slug = 'hilaac-safari'
on conflict (restaurant_id) do update
set enabled = excluded.enabled,
    target_order_count = excluded.target_order_count,
    reward_description = excluded.reward_description;

insert into loyalty_progress (restaurant_id, phone_normalized, current_count, available_rewards)
select id, '252612345678', 2, 0
from restaurants
where slug = 'baba-s-grill-and-cafe'
on conflict (restaurant_id, phone_normalized) do update
set current_count = excluded.current_count,
    available_rewards = excluded.available_rewards,
    updated_at = now();

insert into loyalty_progress (restaurant_id, phone_normalized, current_count, available_rewards)
select id, '252612345678', 1, 0
from restaurants
where slug = 'hilaac-safari'
on conflict (restaurant_id, phone_normalized) do update
set current_count = excluded.current_count,
    available_rewards = excluded.available_rewards,
    updated_at = now();

select r.slug, lp.phone_normalized, lp.current_count, lp.available_rewards, ls.reward_description
from loyalty_progress lp
join restaurants r on r.id = lp.restaurant_id
join loyalty_settings ls on ls.restaurant_id = lp.restaurant_id
where lp.phone_normalized = '252612345678'
order by r.slug;
