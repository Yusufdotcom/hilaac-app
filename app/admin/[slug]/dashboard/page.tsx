import { ShoppingBag, DollarSign, Table2, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { DashboardRecentOrders } from "@/components/admin/dashboard/dashboard-recent-orders";
import { formatCurrency, daysUntil } from "@/lib/utils";
import type { OrderWithItems } from "@/types/database";

type DashboardFetchError = {
  label: string;
  message: string;
};

export default async function DashboardPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug);
  const supabase = createClient();

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfDayIso = startOfDay.toISOString();

  const fetchErrors: DashboardFetchError[] = [];

  const [
    ordersTodayResult,
    revenueTodayResult,
    recentOrdersResult,
    activeTablesResult,
    openOrdersResult,
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
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("tables")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .eq("is_active", true),
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", restaurant.id)
      .gte("created_at", startOfDayIso)
      .neq("status", "completed")
      .neq("status", "delivered"),
  ]);

  if (ordersTodayResult.error) {
    fetchErrors.push({ label: "Orders today", message: ordersTodayResult.error.message });
  }
  if (revenueTodayResult.error) {
    fetchErrors.push({ label: "Revenue today", message: revenueTodayResult.error.message });
  }
  if (recentOrdersResult.error) {
    fetchErrors.push({ label: "Recent orders", message: recentOrdersResult.error.message });
  }
  if (activeTablesResult.error) {
    fetchErrors.push({ label: "Active tables", message: activeTablesResult.error.message });
  }
  if (openOrdersResult.error) {
    fetchErrors.push({ label: "Open orders", message: openOrdersResult.error.message });
  }

  const ordersToday = Number(ordersTodayResult.data ?? 0);
  const revenueToday = Number(revenueTodayResult.data ?? 0);
  const recentOrders = (recentOrdersResult.data as OrderWithItems[]) ?? [];
  const activeTables = activeTablesResult.count ?? 0;
  const openOrders = openOrdersResult.count ?? 0;
  const trialDaysLeft = daysUntil(restaurant.subscription_end_date);

  const stats = [
    { label: "Orders Today", value: ordersToday, icon: ShoppingBag },
    { label: "Revenue Today", value: formatCurrency(revenueToday), icon: DollarSign },
    { label: "Active Tables", value: activeTables, icon: Table2 },
    { label: "Open Orders", value: openOrders, icon: Clock },
  ];

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, here&apos;s what&apos;s happening today.</p>
        </div>
        {restaurant.subscription_tier === "trial" && (
          <Badge variant={trialDaysLeft <= 2 ? "destructive" : "secondary"} className="text-sm">
            {trialDaysLeft > 0 ? `${trialDaysLeft} day(s) left in trial` : "Trial expired"}
          </Badge>
        )}
      </div>

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="w-full overflow-hidden">
            <CardContent className="flex items-center justify-between p-4 sm:p-5">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold">{stat.value}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <stat.icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {fetchErrors.some((e) => e.label === "Recent orders") ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Could not load recent orders.
          </CardContent>
        </Card>
      ) : (
        <DashboardRecentOrders restaurantId={restaurant.id} initialOrders={recentOrders} />
      )}
    </div>
  );
}
