export type LoyaltySettings = {
  restaurant_id: string;
  enabled: boolean;
  target_order_count: number;
  reward_description: string;
  created_at?: string;
  updated_at?: string;
};

export type LoyaltyProgress = {
  restaurant_id: string;
  phone_normalized: string;
  current_count: number;
  available_rewards: number;
  updated_at: string;
};

/** Safe customer-facing loyalty snapshot (no phone). */
export type LoyaltyCustomerStatus = {
  enabled: boolean;
  target_order_count: number;
  reward_description: string;
  current_count: number;
  available_rewards: number;
  /** Orders still needed for the next reward (0 if a reward is already available). */
  orders_away: number;
};

export type LoyaltyAdminStats = {
  customers_with_progress: number;
  customers_with_rewards: number;
  total_redemptions: number;
};
