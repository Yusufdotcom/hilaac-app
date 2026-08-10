import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";

/**
 * GET /api/admin/search?q= — orders (number/phone), menu items, staff.
 */
export async function GET(req: NextRequest) {
  const gate = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!gate.ok) return gate.response;

  const restaurantId = gate.profile.restaurant_id!;
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 1) {
    return NextResponse.json({ orders: [], menuItems: [], staff: [] });
  }

  const like = `%${q.replace(/[%_,]/g, "")}%`;
  const numeric = q.replace(/^#/, "").trim();
  const asNumber = Number(numeric);
  const hasOrderNumber = Number.isFinite(asNumber) && /^\d+$/.test(numeric);

  const ordersQuery = gate.supabase
    .from("orders")
    .select("id, order_number, customer_phone, total, status, created_at")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false })
    .limit(8);

  const [ordersRes, menuRes, staffRes] = await Promise.all([
    hasOrderNumber
      ? ordersQuery.or(`order_number.eq.${asNumber},customer_phone.ilike.${like}`)
      : ordersQuery.ilike("customer_phone", like),
    gate.supabase
      .from("menu_items")
      .select("id, name, price, is_available")
      .eq("restaurant_id", restaurantId)
      .ilike("name", like)
      .order("name")
      .limit(8),
    gate.supabase
      .from("profiles")
      .select("id, full_name, phone, role, is_active")
      .eq("restaurant_id", restaurantId)
      .or(`full_name.ilike.${like},phone.ilike.${like}`)
      .order("full_name")
      .limit(8),
  ]);

  return NextResponse.json({
    orders: ordersRes.data ?? [],
    menuItems: menuRes.data ?? [],
    staff: staffRes.data ?? [],
    errors: {
      orders: ordersRes.error?.message ?? null,
      menuItems: menuRes.error?.message ?? null,
      staff: staffRes.error?.message ?? null,
    },
  });
}
