import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminLayoutShell } from "@/components/admin/admin-layout-shell";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { getAdminSlugRedirect } from "@/lib/admin/resolve-user-restaurant";
import { getOwnerBranches } from "@/lib/admin/owner-branches";
import { PENDING_CASHIER_CONFIRMATION } from "@/lib/payments/constants";
import { fetchRestaurantAlerts } from "@/lib/alerts/fetch-alerts";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const slugRedirect = await getAdminSlugRedirect(supabase, user.id, params.slug);
  if (slugRedirect) redirect(slugRedirect);

  const { restaurant, profile, platformSupport } = await getRestaurantContext(params.slug, [
    "owner",
    "manager",
  ]);

  const branches =
    !platformSupport && profile.role === "owner"
      ? await getOwnerBranches(supabase, user.id)
      : [];

  const userName =
    profile.full_name?.trim() ||
    user.user_metadata?.full_name?.trim() ||
    user.email?.split("@")[0] ||
    "User";

  const [{ count: awaitingEnum }, { count: awaitingLegacy }, alerts] = await Promise.all([
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .eq("payment_status", PENDING_CASHIER_CONFIRMATION),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .eq("payment_status", "pending")
      .not("customer_confirmed_at", "is", null),
    fetchRestaurantAlerts(supabase, restaurant),
  ]);

  const awaitingOrdersCount = (awaitingEnum ?? 0) + (awaitingLegacy ?? 0);

  return (
    <AdminLayoutShell
      restaurantName={restaurant.name}
      logoUrl={restaurant.logo_url}
      subscriptionTier={restaurant.subscription_tier}
      subscriptionEndDate={restaurant.subscription_end_date}
      brandColor={restaurant.brand_color}
      userName={userName}
      userRole={platformSupport ? "owner" : profile.role}
      avatarUrl={profile.avatar_url ?? null}
      isPlatformAdmin={profile.is_platform_admin === true}
      platformSupportView={platformSupport}
      currentSlug={params.slug}
      branches={branches}
      awaitingOrdersCount={awaitingOrdersCount}
      alertsCount={alerts.length}
      currency={restaurant.currency ?? "USD"}
      currencyRate={
        restaurant.currency === "SOS"
          ? Number(restaurant.currency_rate) > 0
            ? Number(restaurant.currency_rate)
            : 571
          : 1
      }
    >
      {children}
    </AdminLayoutShell>
  );
}
