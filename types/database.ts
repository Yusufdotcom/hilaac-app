export type UserRole = "owner" | "manager" | "waiter" | "kitchen" | "cashier";
export type PaymentMode = "ussd" | "api";
export type SubscriptionTier = "trial" | "starter" | "pro";
export type SubscriptionStatus = "active" | "expired";
export type OrderType = "dine-in" | "takeaway";
export type OrderStatus = "new" | "preparing" | "ready" | "delivered" | "completed";
export type PaymentStatus = "pending" | "paid" | "failed";
export type PaymentMethod = "evc" | "edahab";

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  branch_name: string | null;
  owner_id: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
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
  is_active: boolean;
  is_demo: boolean;
  demo_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  restaurant_id: string | null;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  updated_at: string;
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

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  display_order: number;
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
  image_url: string | null;
  is_available: boolean;
  is_top_pick: boolean;
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

export interface Order {
  id: string;
  order_number: number | null;
  restaurant_id: string;
  table_id: string | null;
  order_type: OrderType;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod | null;
  payment_reference: string | null;
  total: number;
  customer_phone: string | null;
  notes: string | null;
  delivered_by: string | null;
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
