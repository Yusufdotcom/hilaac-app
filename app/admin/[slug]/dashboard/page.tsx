import Link from "next/link";
import { ShoppingBag, DollarSign, Table2, Clock, AlertCircle, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { DashboardRecentOrders } from "@/components/admin/dashboard/dashboard-recent-orders";
import { DashboardStatCard } from "@/components/admin/dashboard/dashboard-stat-card";
import { DashboardGreeting } from "@/components/admin/dashboard/dashboard-greeting";
import { BusinessHealthCard } from "@/components/admin/dashboard/business-health-card";
import { TodaysTipCard } from "@/components/admin/dashboard/todays-tip-card";
import { DashboardAlertsPreview } from "@/components/admin/dashboard/dashboard-alerts-preview";
import { DashboardQuickLinks } from "@/components/admin/dashboard/dashboard-quick-links";
import { RecapCards } from "@/components/admin/dashboard/recap-cards";
import { fetchDailyRecap, fetchMonthlyRecap } from "@/lib/recap/fetch-recap";
import { fetchDashboardExtras } from "@/lib/dashboard/fetch-dashboard-extras";
import { computeBusinessHealth } from "@/lib/dashboard/business-health";
import { fetchRestaurantAlerts } from "@/lib/alerts/fetch-alerts";
import { PENDING_CASHIER_CONFIRMATION } from "@/lib/payments/constants";
import { formatCurrency, daysUntil } from "@/lib/utils";
import { APP_TIMEZONE, getAppDayBounds } from "@/lib/time/app-calendar";
import type { OrderWithItems } from "@/types/database";

type DashboardFetchError = {
  label: string;
  message: string;
};

function pctChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function DashboardPage({ params }: { params: { slug: string } }) {
  const { restaurant, profile } = await getRestaurantContext(params.slug);
  const supabase = createClient();

  const { start: dayStart, end: dayEnd } = getAppDayBounds(0);
  const { start: yStart, end: yEnd } = getAppDayBounds(-1);
  const dayStartIso = dayStart.toISOString();
  const dayEndIso = dayEnd.toISOString();
  const yStartIso = yStart.toISOString();
  const yEndIso = yEnd.toISOString();

  console.info("[dashboard] today bounds", {
    timezone: APP_TIMEZONE,
    restaurantId: restaurant.id,
    dayStart: dayStartIso,
    dayEnd: dayEndIso,
  });

  const fetchErrors: DashboardFetchError[] = [];

  const [
    ordersTodayResult,
    revenueTodayResult,
    todaysOrdersResult,
    activeTablesResult,
    totalTablesResult,
    openOrdersResult,
    awaitingCashierEnumResult,
    awaitingCashierLegacyResult,
    ordersYesterdayResult,
    revenueYesterdayResult,
    dailyRecapResult,
    monthlyRecapResult,
    extras,
    restaurantAlerts,
  ] = await Promise.all([
    supabase.rpc("get_dashboard_orders_today", {
      p_restaurant_id: restaurant.id,
    }),
    supabase.rpc("get_dashboard_revenue_today", {
      p_restaurant_id: restaurant.id,
    }),
    supabase
      .from("orders")
      .select("*, table:table_id(*), order_items(*, menu_item:menu_item_id(*))")
      .eq("restaurant_id", restaurant.id)
      .eq("payment_status", "paid")
      .gte("created_at", dayStartIso)
      .lt("created_at", dayEndIso)
      .order("created_at", { ascending: false }),
    supabase
      .from("tables")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true),
    supabase
      .from("tables")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .gte("created_at", dayStartIso)
      .lt("created_at", dayEndIso)
      .neq("status", "completed")
      .neq("status", "delivered"),
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
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .eq("payment_status", "paid")
      .gte("created_at", yStartIso)
      .lt("created_at", yEndIso),
    supabase
      .from("orders")
      .select("total")
      .eq("restaurant_id", restaurant.id)
      .eq("payment_status", "paid")
      .gte("created_at", yStartIso)
      .lt("created_at", yEndIso),
    fetchDailyRecap(supabase, restaurant).then(
      (recap) => ({ recap, error: null as string | null }),
      (err: unknown) => ({
        recap: null,
        error: err instanceof Error ? err.message : "Could not load daily recap",
      })
    ),
    fetchMonthlyRecap(supabase, restaurant).then(
      (recap) => ({ recap, error: null as string | null }),
      (err: unknown) => ({
        recap: null,
        error: err instanceof Error ? err.message : "Could not load monthly recap",
      })
    ),
    fetchDashboardExtras(supabase, restaurant.id),
    fetchRestaurantAlerts(supabase, restaurant),
  ]);

  if (ordersTodayResult.error) {
    fetchErrors.push({ label: "Orders today", message: ordersTodayResult.error.message });
  }
  if (revenueTodayResult.error) {
    fetchErrors.push({ label: "Revenue today", message: revenueTodayResult.error.message });
  }
  if (todaysOrdersResult.error) {
    fetchErrors.push({ label: "Today's orders list", message: todaysOrdersResult.error.message });
  }
  if (activeTablesResult.error) {
    fetchErrors.push({ label: "Active tables", message: activeTablesResult.error.message });
  }
  if (openOrdersResult.error) {
    fetchErrors.push({ label: "Open orders", message: openOrdersResult.error.message });
  }
  if (awaitingCashierEnumResult.error) {
    fetchErrors.push({
      label: "Awaiting payment confirmation",
      message: awaitingCashierEnumResult.error.message,
    });
  }
  if (awaitingCashierLegacyResult.error) {
    fetchErrors.push({
      label: "Awaiting payment confirmation (legacy)",
      message: awaitingCashierLegacyResult.error.message,
    });
  }
  if (extras.sparklineError) {
    fetchErrors.push({ label: "KPI sparklines", message: extras.sparklineError });
  }
  // tipError: silent — TodaysTipCard already shows fallback copy

  const ordersToday = Number(ordersTodayResult.data ?? 0);
  const revenueToday = Number(revenueTodayResult.data ?? 0);
  const todaysOrders = (todaysOrdersResult.data as OrderWithItems[]) ?? [];
  const activeTables = activeTablesResult.count ?? 0;
  const totalTables = totalTablesResult.count ?? 0;
  const openOrders = openOrdersResult.count ?? 0;
  const awaitingPaymentConfirmation =
    (awaitingCashierEnumResult.count ?? 0) + (awaitingCashierLegacyResult.count ?? 0);
  const trialDaysLeft = daysUntil(restaurant.subscription_end_date);

  const ordersYesterday = ordersYesterdayResult.count ?? 0;
  const revenueYesterday = (revenueYesterdayResult.data ?? []).reduce(
    (sum, row) => sum + Number(row.total ?? 0),
    0
  );

  const ordersDelta = pctChange(ordersToday, ordersYesterday);
  const revenueDelta = pctChange(revenueToday, revenueYesterday);

  const health = computeBusinessHealth({
    revenueDeltaPct: revenueDelta,
    ordersDeltaPct: ordersDelta,
    awaitingPaymentConfirmation,
    revenueAvailable: !revenueTodayResult.error && !revenueYesterdayResult.error,
    ordersAvailable: !ordersTodayResult.error && !ordersYesterdayResult.error,
    backlogAvailable:
      !awaitingCashierEnumResult.error && !awaitingCashierLegacyResult.error,
  });

  return (
    <div className="w-full min-w-0 max-w-full space-y-6">
      <DashboardGreeting fullName={profile.full_name} />

      {restaurant.subscription_tier === "trial" && (
        <Badge variant={trialDaysLeft <= 2 ? "destructive" : "secondary"} className="text-sm">
          {trialDaysLeft > 0 ? `${trialDaysLeft} day(s) left in trial` : "Trial expired"}
        </Badge>
      )}

      {fetchErrors.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Some dashboard data could not be loaded</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {fetchErrors.map((err) => (
                <li key={err.label}>
                  {err.label}: {err.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BusinessHealthCard health={health} />
        <TodaysTipCard tip={extras.tip} />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard
          label="Orders Today"
          value={ordersToday}
          icon={ShoppingBag}
          delta={ordersDelta}
          sparkline={extras.sparklines.orders}
        />
        <DashboardStatCard
          label="Revenue Today"
          value={formatCurrency(revenueToday)}
          icon={DollarSign}
          delta={revenueDelta}
          sparkline={extras.sparklines.revenue}
        />
        <DashboardStatCard
          label="Active Tables"
          value={
            <>
              {activeTables}{" "}
              <span className="text-sm font-normal text-[var(--admin-muted)]">
                / {totalTables}
              </span>
            </>
          }
          icon={Table2}
          delta={null}
          sparkline={extras.sparklines.activeTables}
        />
        <DashboardStatCard
          label="Open Orders"
          value={openOrders}
          icon={Clock}
          delta={null}
          sparkline={extras.sparklines.openOrders}
        />
      </div>

      {awaitingPaymentConfirmation > 0 && (
        <div
          className="admin-brand-tint flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"
          style={{
            borderColor: "color-mix(in srgb, var(--admin-brand, #9E2E2E) 25%, transparent)",
          }}
        >
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: "var(--admin-brand, #9E2E2E)" }}
            >
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--admin-brand, #9E2E2E)" }}>
                {awaitingPaymentConfirmation}{" "}
                {awaitingPaymentConfirmation === 1 ? "order" : "orders"} awaiting payment
                confirmation
              </p>
              <p className="text-xs text-[var(--admin-muted,#64748B)]">
                Not counted in today&apos;s paid Orders/Revenue. Includes older backlog.
              </p>
            </div>
          </div>
          <Link
            href={`/admin/${params.slug}/orders`}
            className="w-full shrink-0 rounded-xl px-4 py-2 text-center text-sm font-semibold text-white sm:w-auto"
            style={{ backgroundColor: "var(--admin-brand, #9E2E2E)" }}
          >
            Review orders
          </Link>
        </div>
      )}

      <DashboardAlertsPreview items={restaurantAlerts} slug={params.slug} />

      <DashboardQuickLinks
        slug={params.slug}
        pendingOrders={awaitingPaymentConfirmation}
        menuItemCount={extras.menuItemCount}
      />

      <RecapCards
        daily={dailyRecapResult.recap}
        monthly={monthlyRecapResult.recap}
        tier={restaurant.subscription_tier}
        dailyError={dailyRecapResult.error}
        monthlyError={monthlyRecapResult.error}
      />

      {fetchErrors.some((e) => e.label === "Today's orders list") ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Could not load today&apos;s orders.
          </CardContent>
        </Card>
      ) : (
        <DashboardRecentOrders
          restaurantId={restaurant.id}
          initialOrders={todaysOrders}
          dayStartIso={dayStartIso}
          dayEndIso={dayEndIso}
          ordersTodayCount={ordersToday}
        />
      )}
    </div>
  );
}
