import { NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";
import { PENDING_CASHIER_CONFIRMATION } from "@/lib/payments/constants";

export type AdminNotificationItem = {
  id: string;
  type: "pending_payment" | "insight";
  title: string;
  body: string;
  href: string;
};

/**
 * GET /api/admin/notifications — pending confirmations + Insights teaser.
 */
export async function GET() {
  const gate = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!gate.ok) return gate.response;

  const restaurantId = gate.profile.restaurant_id!;
  const { data: restaurant } = await gate.supabase
    .from("restaurants")
    .select("slug, subscription_tier")
    .eq("id", restaurantId)
    .maybeSingle();

  const slug = restaurant?.slug ?? "";

  const [{ data: pendingEnum }, { data: pendingLegacy }] = await Promise.all([
    gate.supabase
      .from("orders")
      .select("id, order_number, total, created_at, customer_phone")
      .eq("restaurant_id", restaurantId)
      .eq("payment_status", PENDING_CASHIER_CONFIRMATION)
      .order("created_at", { ascending: false })
      .limit(8),
    gate.supabase
      .from("orders")
      .select("id, order_number, total, created_at, customer_phone")
      .eq("restaurant_id", restaurantId)
      .eq("payment_status", "pending")
      .not("customer_confirmed_at", "is", null)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const seen = new Set<string>();
  const pending = [...(pendingEnum ?? []), ...(pendingLegacy ?? [])].filter((o) => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });

  const items: AdminNotificationItem[] = pending.slice(0, 8).map((o) => ({
    id: `pending-${o.id}`,
    type: "pending_payment",
    title:
      o.order_number != null ? `Order #${o.order_number} awaits confirmation` : "Order awaits confirmation",
    body: "Customer marked payment — confirm in Orders.",
    href: `/admin/${slug}/orders`,
  }));

  if (restaurant?.subscription_tier === "pro" || restaurant?.subscription_tier === "trial") {
    items.push({
      id: "insights-teaser",
      type: "insight",
      title: "New Insights available",
      body: "Open Reports for trending items, peak hours, and tips.",
      href: `/admin/${slug}/reports`,
    });
  }

  return NextResponse.json({
    items,
    badgeCount: pending.length + (items.some((i) => i.type === "insight") ? 1 : 0),
    pendingCount: pending.length,
  });
}
