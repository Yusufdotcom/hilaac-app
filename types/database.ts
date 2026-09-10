export type UserRole = "owner" | "manager" | "waiter" | "kitchen" | "cashier";
export type PaymentMode = "ussd" | "api";
export type BillingModel = "pay_before" | "pay_after";
export type SubscriptionTier =
  | "trial"
  | "starter"
  | "pro"
  | "goronyo"
  | "gorgor"
  | "galeyr"
  | "somali_airlines";
export type SubscriptionStatus = "active" | "expired";
export type OrderType = "dine-in" | "takeaway";
export type OrderStatus =
  | "awaiting_payment"
  | "new"
  | "preparing"
  | "ready"
  | "delivered"
  | "completed"
  | "cancelled";

export type OrderActionType = "confirm_payment" | "cancel" | "update_status";

export interface OrderActionLog {
  id: string;
  restaurant_id: string;
  order_id: string;
  action: OrderActionType;
  reason: string | null;
  actor_id: string;
  previous_status: string | null;
  new_status: string | null;
  previous_payment_status: string | null;
  new_payment_status: string | null;
  created_at: string;
}
export type PaymentStatus = "pending" | "pending_cashier_confirmation" | "paid" | "failed";
export type PaymentMethod = "evc" | "edahab";

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  previous_slug?: string | null;
  branch_name: string | null;
  owner_id: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  takeaway_hotline?: string | null;
  payment_mode: PaymentMode;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  subscription_end_date: string;
  evc_ussd_code: string | null;
  edahab_ussd_code: string | null;
  evc_merchant_id_encrypted?: string | null;
  evc_api_key_encrypted?: string | null;
  edahab_merchant_id_encrypted?: string | null;
  edahab_api_key_encrypted?: string | null;
  dine_in_enabled: boolean;
  takeaway_enabled: boolean;
  billing_model_dinein: BillingModel;
  billing_model_takeaway: BillingModel;
  brand_color: string | null;
  custom_branding_enabled: boolean;
  is_active: boolean;
  is_demo: boolean;
  demo_expires_at: string | null;
  last_subscription_reminder_at?: string | null;
  opening_time?: string | null;
  closing_time?: string | null;
  business_days?: number[] | null;
  /** Display currency; default USD. SOS uses currency_rate (SOS per 1 USD). */
  currency?: string;
  currency_rate?: number;
  /**
   * Step 16 retail-readiness (schema only — no retail UI yet).
   * When business_type = 'retail': Menu→Products, hide Kitchen/Waiter, reuse inventory, adapt Cashier.
   */
  business_type?: string;
  /** Somali Airlines: ramadan | eid | null (off). Only one season at a time. */
  active_season?: "ramadan" | "eid" | null;
  created_at: string;
  updated_at: string;
}

export type RamadanPackageType = "normal" | "buffet";
export type RamadanMealType = "iftar" | "suhoor" | "both";
export type SeasonKind = "ramadan" | "eid";
export type RamadanPaymentStatus = "pending" | "paid" | "refunded";
export type EventType =
  | "wedding"
  | "graduation"
  | "corporate"
  | "birthday"
  | "meeting"
  | "other";
export type EventBookingStatus = "inquiry" | "confirmed" | "cancelled" | "completed";
export type EventBookingSource = "direct" | "online_link" | "phone" | "walkin";
export type TableReservationStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface RamadanPackage {
  id: string;
  restaurant_id: string;
  name: string;
  type: RamadanPackageType;
  price: number;
  description: string | null;
  menu_items: unknown;
  buffet_start_time: string | null;
  buffet_end_time: string | null;
  max_daily_capacity: number | null;
  valid_from: string;
  valid_to: string;
  meal_type: RamadanMealType | null;
  season: SeasonKind;
  is_active: boolean;
  created_at: string;
}

export interface RamadanSubscription {
  id: string;
  package_id: string;
  restaurant_id: string;
  customer_name: string;
  customer_phone: string;
  pass_code: string;
  payment_status: RamadanPaymentStatus;
  payment_amount: number | null;
  gifted_by: string | null;
  gifted_by_phone: string | null;
  created_at: string;
}

export interface RamadanCheckin {
  id: string;
  subscription_id: string;
  package_id: string;
  restaurant_id: string;
  checkin_date: string;
  checkin_time: string;
  confirmed_by: string | null;
}

export interface EventSpace {
  id: string;
  restaurant_id: string;
  name: string;
  capacity: number | null;
  description: string | null;
  price_per_event: number | null;
  is_active: boolean;
  created_at: string;
}

export interface EventBooking {
  id: string;
  restaurant_id: string;
  space_id: string | null;
  event_type: EventType;
  event_name: string | null;
  contact_name: string;
  contact_phone: string;
  contact_organization: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  guest_count: number | null;
  menu_package: string | null;
  total_price: number | null;
  deposit_paid: number;
  balance_due_date: string | null;
  status: EventBookingStatus;
  notes: string | null;
  booking_source: EventBookingSource;
  created_by: string | null;
  created_at: string;
}

export interface TableReservation {
  id: string;
  restaurant_id: string;
  customer_name: string;
  customer_phone: string;
  guest_count: number;
  reservation_date: string;
  reservation_time: string;
  special_requests: string | null;
  status: TableReservationStatus;
  deposit_paid: number;
  booking_source: string;
  created_at: string;
}

export interface Profile {
  id: string;
  restaurant_id: string | null;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  /** Optional hourly wage for labor cost math. */
  hourly_rate?: number | null;
  /** Platform Super Admin — never grantable via restaurant Staff UI. */
  is_platform_admin?: boolean;
  /** scrypt hash of 4–6 digit staff PIN (Kitchen/Waiter/Cashier tablets). */
  staff_pin_hash?: string | null;
  pin_last_used?: string | null;
  created_at: string;
  updated_at: string;
}

export type SubscriptionRenewalStatus =
  | "pending_confirmation"
  | "confirmed"
  | "rejected";

export interface SubscriptionRenewal {
  id: string;
  restaurant_id: string;
  requested_by: string;
  tier: SubscriptionTier;
  amount: number;
  method: PaymentMethod;
  status: SubscriptionRenewalStatus;
  tx_ref: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformSettings {
  id: number;
  evc_ussd_code_encrypted: string | null;
  edahab_ussd_code_encrypted: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface RestaurantTable {
  id: string;
  restaurant_id: string;
  table_number: string;
  is_active: boolean;
  created_at: string;
}

export interface Waiter {
  id: string;
  restaurant_id: string;
  name: string;
  created_at: string;
}

export interface LoyaltySettings {
  restaurant_id: string;
  enabled: boolean;
  target_order_count: number;
  reward_description: string;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyProgress {
  id: string;
  restaurant_id: string;
  phone_normalized: string;
  current_count: number;
  available_rewards: number;
  updated_at: string;
}

export interface LoyaltyRedemption {
  id: string;
  restaurant_id: string;
  phone_normalized: string;
  redeemed_by: string;
  redeemed_at: string;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  display_order: number;
  /** Custom special-instructions hint; null → app heuristic / generic fallback. */
  special_instructions_placeholder?: string | null;
  created_at: string;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  ingredients: string | null;
  price: number;
  /** Ingredient / prep cost for margin; nullable until filled. */
  cost_price?: number | null;
  image_url: string | null;
  is_available: boolean;
  is_top_pick: boolean;
  /**
   * When true, use menu_item_add_ons instead of the category's default add-ons.
   * When false (default), inherit category_add_ons.
   */
  use_custom_add_ons?: boolean;
  created_at: string;
  updated_at: string;
}

export interface AddOn {
  id: string;
  restaurant_id: string;
  name: string;
  price: number;
  created_at: string;
}

/** Junction: which catalog add-ons belong to a category. */
export interface CategoryAddOn {
  category_id: string;
  add_on_id: string;
  created_at?: string;
}

/** Junction: per-item override set (only when menu_items.use_custom_add_ons). */
export interface MenuItemAddOn {
  menu_item_id: string;
  add_on_id: string;
  created_at?: string;
}

export interface Order {
  id: string;
  order_number: number | null;
  restaurant_id: string;
  table_id: string | null;
  order_type: OrderType;
  status: OrderStatus;
  payment_status: PaymentStatus;
  billing_model: BillingModel | null;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  total: number;
  customer_phone: string | null;
  /** Explicit opt-in for WhatsApp marketing / re-engagement. */
  whatsapp_marketing_opt_in?: boolean;
  notes: string | null;
  delivered_by: string | null;
  /** Guest 1–5 star rating after delivery. */
  customer_rating?: number | null;
  customer_rated_at?: string | null;
  /** Staff acceptance before kitchen cooks — independent of payment. */
  accepted_at: string | null;
  accepted_by: string | null;
  /** Staff who created a manual POS order (null for guest QR). */
  created_by?: string | null;
  customer_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItemAddOn {
  id: string;
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  quantity: number;
  add_ons: OrderItemAddOn[];
  notes: string | null;
  price_at_time: number;
  created_at: string;
}

export interface OrderWithItems extends Order {
  order_items: (OrderItem & { menu_item?: MenuItem | null })[];
  table?: RestaurantTable | null;
}

export type ExpenseCategory = "rent" | "utilities" | "labor" | "supplies" | "other";

export interface Expense {
  id: string;
  restaurant_id: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  restaurant_id: string;
  name: string;
  unit: string;
  current_stock: number;
  daily_usage_estimate: number | null;
  reorder_level: number | null;
  supplier_delivery_days: number;
  cost_per_unit: number | null;
  updated_at: string;
}

export interface StaffShift {
  id: string;
  restaurant_id: string;
  profile_id: string | null;
  staff_name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  created_at: string;
}

/** Aggregated from orders via customer_profiles view. */
export interface CustomerProfile {
  restaurant_id: string;
  customer_phone: string;
  total_visits: number;
  lifetime_spend: number;
  last_visit: string;
  first_visit: string;
}
