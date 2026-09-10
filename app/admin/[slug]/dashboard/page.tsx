import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { DashboardRecentOrders } from "@/components/admin/dashboard/dashboard-recent-orders";
import { DashboardLiveStats } from "@/components/admin/dashboard/dashboard-live-stats";
import { DashboardGreeting } from "@/components/admin/dashboard/dashboard-greeting";
import { BusinessHealthCard } from "@/components/admin/dashboard/business-health-card";
import { TodaysTipCard } from "@/components/admin/dashboard/todays-tip-card";
import { DashboardAlertsPreview } from "@/components/admin/dashboard/dashboard-alerts-preview";
import { DashboardQuickLinks } from "@/components/admin/dashboard/dashboard-quick-links";
import { RecapCards } from "@/components/admin/dashboard/recap-cards";
import { RamadanOverviewCard } from "@/components/admin/dashboard/ramadan-overview-card";
import { TodaysEventsCard } from "@/components/admin/dashboard/todays-events-card";
import { fetchDailyRecap, fetchMonthlyRecap } from "@/lib/recap/fetch-recap";
import { fetchDashboardExtras } from "@/lib/dashboard/fetch-dashboard-extras";
import { computeBusinessHealth } from "@/lib/dashboard/business-health";
import { fetchRestaurantAlerts } from "@/lib/alerts/fetch-alerts";
import { fetchRamadanOverview } from "@/lib/somali-airlines/season-ops";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { PENDING_CASHIER_CONFIRMATION } from "@/lib/payments/constants";
import { daysUntil } from "@/lib/utils";
import { APP_TIMEZONE, getAppDayBounds } from "@/lib/time/app-calendar";
import { appDayKey, appWeekKey } from "@/lib/recap/recap-dismiss";
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

  const { start: dayStart, end: dayEnd, ymd: todayYmd } = getAppDayBounds(0);
  const { start: yStart, end: yEnd } = getAppDayBounds(-1);
  const todayDateKey = `${todayYmd.year}-${String(todayYmd.month).padStart(2, "0")}-${String(todayYmd.day).padStart(2, "0")}`;
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

  const season =
    restaurant.active_season === "ramadan" || restaurant.active_season === "eid"
      ? restaurant.active_season
      : null;
  const showRamadanOverview =
    !!season && canUseFeature(restaurant.subscription_tier, "ramadan_packages");
  const showEvents =
    canUseFeature(restaurant.subscription_tier, "event_hall_management");

  const [ramadanOverview, todaysEvents] = await Promise.all([
    showRamadanOverview
      ? fetchRamadanOverview(supabase, restaurant.id, season!).catch(() => null)
      : Promise.resolve(null),
    showEvents
      ? Promise.resolve(
          supabase
            .from("event_bookings")
            .select(
              "id, event_type, event_name, contact_name, guest_count, start_time, status, total_price, space:space_id(name)"
            )
            .eq("restaurant_id", restaurant.id)
            .eq("event_date", todayDateKey)
            .in("status", ["inquiry", "confirmed"])
            .order("start_time", { ascending: true })
        )
          .then(({ data }) =>
            (data ?? []).map((row) => ({
              id: row.id as string,
              event_type: row.event_type as string,
              event_name: (row.event_name as string | null) ?? null,
              contact_name: row.contact_name as string,
              guest_count: (row.guest_count as number | null) ?? null,
              start_time: (row.start_time as string | null) ?? null,
              status: row.status as string,
              total_price: row.total_price != null ? Number(row.total_price) : null,
              space_name:
                row.space && typeof row.space === "object" && "name" in row.space
                  ? String((row.space as { name?: string }).name ?? "") || null
                  : null,
            }))
          )
          .catch(() => [])
      : Promise.resolve([]),
  ]);

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

      {ramadanOverview ? (
        <RamadanOverviewCard slug={params.slug} overview={ramadanOverview} />
      ) : null}

      <TodaysEventsCard slug={params.slug} events={todaysEvents} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BusinessHealthCard health={health} />
        <TodaysTipCard tip={extras.tip} />
      </div>

      <DashboardLiveStats
        restaurantId={restaurant.id}
        initialOrders={todaysOrders}
        dayStartIso={dayStartIso}
        dayEndIso={dayEndIso}
        ordersYesterday={ordersYesterday}
        revenueYesterday={revenueYesterday}
        activeTables={activeTables}
        totalTables={totalTables}
        sparklineOrders={extras.sparklines.orders}
        sparklineRevenue={extras.sparklines.revenue}
        sparklineActiveTables={extras.sparklines.activeTables}
        sparklineOpenOrders={extras.sparklines.openOrders}
        slug={params.slug}
      />

      <DashboardAlertsPreview items={restaurantAlerts} slug={params.slug} />

      <DashboardQuickLinks
        slug={params.slug}
        pendingOrders={awaitingPaymentConfirmation}
        menuItemCount={extras.menuItemCount}
      />

      <RecapCards
        restaurantId={restaurant.id}
        dailyPeriodKey={appDayKey()}
        weeklyPeriodKey={appWeekKey()}
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
