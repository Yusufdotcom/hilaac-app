import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLoyaltyPhone } from "@/lib/loyalty/phone";
import type { LoyaltyCustomerStatus } from "@/lib/loyalty/types";

/**
 * Load loyalty status for an order without exposing the phone number.
 * Uses service-role (or any privileged) client.
 */
export async function getLoyaltyStatusForOrder(
  supabase: SupabaseClient,
  orderId: string
): Promise<LoyaltyCustomerStatus | null> {
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, restaurant_id, customer_phone")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) return null;

  const { data: settings } = await supabase
    .from("loyalty_settings")
    .select("enabled, target_order_count, reward_description")
    .eq("restaurant_id", order.restaurant_id)
    .maybeSingle();

  if (!settings?.enabled) return null;

  const target = Math.max(2, Number(settings.target_order_count) || 5);
  const rewardDescription = String(settings.reward_description || "Free item").trim() || "Free item";
  const phone = normalizeLoyaltyPhone(order.customer_phone);

  if (!phone) {
    return {
      enabled: true,
      target_order_count: target,
      reward_description: rewardDescription,
      current_count: 0,
      available_rewards: 0,
      orders_away: target,
    };
  }

  const { data: progress } = await supabase
    .from("loyalty_progress")
    .select("current_count, available_rewards")
    .eq("restaurant_id", order.restaurant_id)
    .eq("phone_normalized", phone)
    .maybeSingle();

  const current = Number(progress?.current_count ?? 0) || 0;
  const available = Number(progress?.available_rewards ?? 0) || 0;
  const ordersAway = Math.max(0, target - current);

  return {
    enabled: true,
    target_order_count: target,
    reward_description: rewardDescription,
    current_count: current,
    available_rewards: available,
    orders_away: ordersAway,
  };
}
