import type { SupabaseClient } from "@supabase/supabase-js";
import { PENDING_CASHIER_CONFIRMATION } from "@/lib/payments/constants";
import { getAppDayBounds } from "@/lib/time/app-calendar";
import { daysUntil, formatCurrency } from "@/lib/utils";
import type { AlertSeverity } from "@/lib/alerts/types";
import { sortAlerts, type RestaurantAlert } from "@/lib/alerts/types";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Consolidate live restaurant signals into severity-sorted alerts.
 * Low-stock / low-margin only appear when inventory / cost_price data exists.
 */
export async function fetchRestaurantAlerts(
  supabase: SupabaseClient,
  restaurant: {
    id: string;
    slug: string;
    subscription_end_date: string;
    subscription_status?: string;
  }
): Promise<RestaurantAlert[]> {
  const slug = restaurant.slug;
  const twoHoursAgo = new Date(Date.now() - TWO_HOURS_MS).toISOString();
  const { start: weekStart } = getAppDayBounds(-6);
  const { end: weekEnd } = getAppDayBounds(0);
  const { start: priorStart } = getAppDayBounds(-13);
  const priorEnd = weekStart;

  const [
    staleAwaitingRes,
    anyAwaitingEnumRes,
    anyAwaitingLegacyRes,
    thisWeekRevRes,
    priorWeekRevRes,
    menuCostRes,
    inventoryRes,
    aiAlertsRes,
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("id, customer_confirmed_at, updated_at, created_at")
      .eq("restaurant_id", restaurant.id)
      .or(
        `payment_status.eq.${PENDING_CASHIER_CONFIRMATION},and(payment_status.eq.pending,customer_confirmed_at.not.is.null)`
      )
      .limit(100),
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
    supabase.rpc("get_revenue_by_period", {
      p_restaurant_id: restaurant.id,
      p_start_date: weekStart.toISOString(),
      p_end_date: weekEnd.toISOString(),
      p_granularity: "daily",
    }),
    supabase.rpc("get_revenue_by_period", {
      p_restaurant_id: restaurant.id,
      p_start_date: priorStart.toISOString(),
      p_end_date: priorEnd.toISOString(),
      p_granularity: "daily",
    }),
    supabase
      .from("menu_items")
      .select("id, name, price, cost_price")
      .eq("restaurant_id", restaurant.id)
      .not("cost_price", "is", null)
      .limit(200),
    supabase
      .from("inventory_items")
      .select("id, name, current_stock, reorder_level")
      .eq("restaurant_id", restaurant.id)
      .limit(200),
    supabase
      .from("ai_alerts")
      .select(
        "id, severity, title, description, why_it_matters, action_label, href, source, created_at"
      )
      .eq("restaurant_id", restaurant.id)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const alerts: RestaurantAlert[] = [];

  // --- Awaiting confirmation > 2 hours (urgent) ---
  const awaitingRows = (staleAwaitingRes.data ?? []) as {
    id: string;
    customer_confirmed_at: string | null;
    updated_at: string | null;
    created_at: string;
  }[];
  const staleCount = awaitingRows.filter((o) => {
    const anchor = o.customer_confirmed_at ?? o.updated_at ?? o.created_at;
    return new Date(anchor).getTime() <= new Date(twoHoursAgo).getTime();
  }).length;

  if (staleCount > 0) {
    alerts.push({
      id: "awaiting-stale",
      severity: "urgent",
      title:
        staleCount === 1
          ? "1 order awaiting confirmation for over 2 hours"
          : `${staleCount} orders awaiting confirmation for over 2 hours`,
      description: "Customers marked payment sent but staff have not confirmed yet.",
      whyItMatters:
        "Unconfirmed payments leave revenue and kitchen status out of sync and frustrate guests.",
      actionLabel: "Review orders",
      href: `/admin/${slug}/orders`,
      rank: 100,
      source: "system",
    });
  } else {
    const anyAwaiting =
      (anyAwaitingEnumRes.count ?? 0) + (anyAwaitingLegacyRes.count ?? 0);
    if (anyAwaiting > 0) {
      alerts.push({
        id: "awaiting-fresh",
        severity: "important",
        title:
          anyAwaiting === 1
            ? "1 order awaiting payment confirmation"
            : `${anyAwaiting} orders awaiting payment confirmation`,
        description: "Confirm payments so they count toward paid revenue.",
        whyItMatters: "Pending confirmations are not included in today's paid Orders/Revenue.",
        actionLabel: "Review orders",
        href: `/admin/${slug}/orders`,
        rank: 90,
        source: "system",
      });
    }
  }

  // --- Subscription expiring within 7 days (important) ---
  const daysLeft = daysUntil(restaurant.subscription_end_date);
  if (daysLeft <= 7) {
    alerts.push({
      id: "subscription-expiring",
      severity: daysLeft <= 1 ? "urgent" : "important",
      title:
        daysLeft <= 0
          ? "Subscription ended — renew to stay live"
          : `Subscription ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
      description: "Renew from Billing to keep ordering and staff tools active.",
      whyItMatters:
        "An expired plan can interrupt QR ordering, staff dashboards, and payment flows.",
      actionLabel: "Go to Billing",
      href: `/admin/${slug}/billing`,
      rank: 95,
      source: "system",
    });
  }

  // --- Revenue down > 20% vs prior week (important) ---
  if (!thisWeekRevRes.error && !priorWeekRevRes.error) {
    const sumRev = (rows: unknown[]): number =>
      (rows ?? []).reduce<number>((s, raw) => {
        const row = raw as Record<string, unknown>;
        return s + (Number(row.revenue ?? 0) || 0);
      }, 0);
    const thisWeek = sumRev((thisWeekRevRes.data as unknown[]) ?? []);
    const priorWeek = sumRev((priorWeekRevRes.data as unknown[]) ?? []);
    if (priorWeek > 0) {
      const dropPct = ((priorWeek - thisWeek) / priorWeek) * 100;
      if (dropPct > 20) {
        alerts.push({
          id: "revenue-down",
          severity: "important",
          title: `Revenue down ${Math.round(dropPct)}% vs last week`,
          description: `${formatCurrency(thisWeek)} this week vs ${formatCurrency(priorWeek)} prior week.`,
          whyItMatters:
            "A sustained drop usually means fewer covers, weaker promo pull, or a payment/ops issue worth checking.",
          actionLabel: "Open Reports",
          href: `/admin/${slug}/reports`,
          rank: 80,
          source: "system",
        });
      }
    }
  }

  // Inventory low-stock / out-of-stock
  const inventory = (inventoryRes.data ?? []) as {
    id: string;
    name: string;
    current_stock: number;
    reorder_level: number | null;
  }[];
  if (inventory.length > 0) {
    const out = inventory.filter((i) => Number(i.current_stock) <= 0);
    const low = inventory.filter((i) => {
      const stock = Number(i.current_stock);
      const reorder = i.reorder_level != null ? Number(i.reorder_level) : null;
      return stock > 0 && reorder != null && stock <= reorder;
    });
    if (out.length > 0) {
      alerts.push({
        id: "inventory-out",
        severity: "urgent",
        title:
          out.length === 1
            ? `${out[0].name} is out of stock`
            : `${out.length} items are out of stock`,
        description: out
          .slice(0, 3)
          .map((i) => i.name)
          .join(", "),
        whyItMatters: "Out-of-stock ingredients stop 86'd dishes and hurt ticket size.",
        actionLabel: "View inventory",
        href: `/admin/${slug}/inventory`,
        rank: 85,
        source: "system",
      });
    } else if (low.length > 0) {
      alerts.push({
        id: "inventory-low",
        severity: "important",
        title:
          low.length === 1
            ? `${low[0].name} is at reorder level`
            : `${low.length} items need reorder`,
        description: low
          .slice(0, 3)
          .map((i) => i.name)
          .join(", "),
        whyItMatters: "Hitting reorder level without an order risks stockouts mid-service.",
        actionLabel: "View inventory",
        href: `/admin/${slug}/inventory`,
        rank: 70,
        source: "system",
      });
    }
  }

  // --- Low margin (when cost_price filled) ---
  const withCost = (menuCostRes.data ?? []) as {
    id: string;
    name: string;
    price: number;
    cost_price: number;
  }[];
  const lowMargin = withCost.filter((item) => {
    const price = Number(item.price);
    const cost = Number(item.cost_price);
    if (!(price > 0) || cost < 0) return false;
    const margin = ((price - cost) / price) * 100;
    return margin < 20;
  });
  if (lowMargin.length > 0) {
    const worst = [...lowMargin].sort((a, b) => {
      const ma = ((Number(a.price) - Number(a.cost_price)) / Number(a.price)) * 100;
      const mb = ((Number(b.price) - Number(b.cost_price)) / Number(b.price)) * 100;
      return ma - mb;
    })[0];
    const margin = Math.round(
      ((Number(worst.price) - Number(worst.cost_price)) / Number(worst.price)) * 100
    );
    alerts.push({
      id: "low-margin",
      severity: "normal",
      title:
        lowMargin.length === 1
          ? `${worst.name} has a low margin (${margin}%)`
          : `${lowMargin.length} items have margins under 20%`,
      description: `Lowest: ${worst.name} at ${margin}% margin.`,
      whyItMatters:
        "Thin margins shrink contribution after labor and overhead — worth a price or recipe review.",
      actionLabel: "Open Menu",
      href: `/admin/${slug}/menu`,
      rank: 40,
      source: "system",
    });
  }

  if (!aiAlertsRes.error) {
    for (const row of aiAlertsRes.data ?? []) {
      const severity = row.severity as AlertSeverity;
      if (severity !== "urgent" && severity !== "important" && severity !== "normal") continue;
      alerts.push({
        id: `ai-${row.id}`,
        severity,
        title: String(row.title),
        description: String(row.description ?? ""),
        whyItMatters: String(row.why_it_matters ?? ""),
        actionLabel: String(row.action_label || "Review"),
        href: String(row.href || `/admin/${slug}/alerts`),
        rank: 75,
        source: "ai",
      });
    }
  } else if (
    !String(aiAlertsRes.error.message || "")
      .toLowerCase()
      .includes("does not exist")
  ) {
    console.error("[alerts] ai_alerts", aiAlertsRes.error.message);
  }

  return sortAlerts(alerts);
}
