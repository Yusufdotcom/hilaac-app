import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderingApp } from "@/components/order/ordering-app";
import { OrderBrandProvider } from "@/components/order/order-brand-context";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: { slug: string } }) {
  const supabase = createClient();

  const { data: restaurant, error } = await supabase
    .from("restaurants")
    .select(
      "id, name, slug, logo_url, payment_mode, evc_ussd_code, edahab_ussd_code, dine_in_enabled, takeaway_enabled, billing_model_dinein, billing_model_takeaway, brand_color, custom_branding_enabled, subscription_tier, is_active"
    )
    .eq("slug", params.slug)
    .maybeSingle();

  if (error) {
    console.error("[order page] restaurant fetch failed:", error.message);
  }

  if (!restaurant || !restaurant.is_active) notFound();

  const [{ data: categories }, { data: menuItems }, { data: addOns }, { data: tables }] = await Promise.all([
    supabase.from("categories").select("*").eq("restaurant_id", restaurant.id).order("display_order"),
    supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .order("created_at"),
    supabase.from("add_ons").select("*").eq("restaurant_id", restaurant.id),
    supabase.from("tables").select("*").eq("restaurant_id", restaurant.id).eq("is_active", true).order("table_number"),
  ]);

  return (
    <OrderBrandProvider
      brandColor={restaurant.brand_color}
      customBrandingEnabled={restaurant.custom_branding_enabled ?? false}
    >
      <OrderingApp
        restaurant={restaurant}
        categories={categories ?? []}
        menuItems={menuItems ?? []}
        addOns={addOns ?? []}
        tables={tables ?? []}
      />
    </OrderBrandProvider>
  );
}
