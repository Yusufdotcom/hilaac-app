import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { fetchRestaurantBrandingBySlug } from "@/lib/brand/fetch-restaurant-branding";
import { HILAAC_GOLD } from "@/lib/brand/restaurant-brand";
import { OrderingApp } from "@/components/order/ordering-app";
import { OrderBrandProvider } from "@/components/order/order-brand-context";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Public QR ordering page — no login required.
 * Uses the service-role client so menu/restaurant data loads for anonymous
 * customers regardless of column-level grants on the anon role.
 */
export default async function OrderPage({ params }: { params: { slug: string } }) {
  const admin = createAdminClient();

  const [{ data: restaurant, error }, branding] = await Promise.all([
    admin
      .from("restaurants")
      .select(
        "id, name, slug, logo_url, payment_mode, evc_ussd_code, edahab_ussd_code, dine_in_enabled, takeaway_enabled, billing_model_dinein, billing_model_takeaway, brand_color, custom_branding_enabled, subscription_tier, is_active"
      )
      .eq("slug", params.slug)
      .maybeSingle(),
    fetchRestaurantBrandingBySlug(params.slug),
  ]);

  if (error) {
    console.error("[order page] restaurant fetch failed:", error.message);
  }

  if (!restaurant) {
    const { data: renamed } = await admin
      .from("restaurants")
      .select("slug, is_active")
      .eq("previous_slug", params.slug)
      .maybeSingle();

    if (renamed?.is_active && renamed.slug) {
      redirect(`/order/${renamed.slug}`);
    }
    notFound();
  }

  if (!restaurant.is_active) notFound();

  const brandColor = branding?.brand_color ?? restaurant.brand_color;
  const customBrandingEnabled =
    branding?.custom_branding_enabled ?? restaurant.custom_branding_enabled ?? false;
  const customerAccentColor = branding?.customerAccentColor ?? HILAAC_GOLD;

  const restaurantWithBranding = {
    ...restaurant,
    brand_color: brandColor,
    custom_branding_enabled: customBrandingEnabled,
  };

  const [{ data: categories }, { data: menuItems }, { data: addOns }, { data: tables }] =
    await Promise.all([
      admin.from("categories").select("*").eq("restaurant_id", restaurant.id).order("display_order"),
      admin
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .order("created_at"),
      admin.from("add_ons").select("*").eq("restaurant_id", restaurant.id),
      admin
        .from("tables")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .order("table_number"),
    ]);

  const categoryIds = (categories ?? []).map((c) => c.id);
  const itemIds = (menuItems ?? []).map((m) => m.id);

  const [{ data: categoryAddOns }, { data: menuItemAddOns }] = await Promise.all([
    categoryIds.length
      ? admin.from("category_add_ons").select("category_id, add_on_id").in("category_id", categoryIds)
      : Promise.resolve({ data: [] as { category_id: string; add_on_id: string }[] }),
    itemIds.length
      ? admin.from("menu_item_add_ons").select("menu_item_id, add_on_id").in("menu_item_id", itemIds)
      : Promise.resolve({ data: [] as { menu_item_id: string; add_on_id: string }[] }),
  ]);

  return (
    <OrderBrandProvider
      brandColor={brandColor}
      customBrandingEnabled={customBrandingEnabled}
      accentColor={customerAccentColor}
    >
      <OrderingApp
        restaurant={restaurantWithBranding}
        categories={categories ?? []}
        menuItems={menuItems ?? []}
        addOns={addOns ?? []}
        categoryAddOns={categoryAddOns ?? []}
        menuItemAddOns={menuItemAddOns ?? []}
        tables={tables ?? []}
      />
    </OrderBrandProvider>
  );
}
