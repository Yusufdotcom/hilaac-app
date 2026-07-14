import { getRestaurantContext } from "@/lib/admin/get-restaurant-context";
import { createClient } from "@/lib/supabase/server";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import { hasProReports, getDateRange } from "@/lib/reports/timeframes";
import { ReportsClient } from "@/components/admin/reports/reports-client";
import type { ReportData, ReportGranularity } from "@/lib/reports/types";

export default async function ReportsPage({ params }: { params: { slug: string } }) {
  const { restaurant } = await getRestaurantContext(params.slug, ["owner", "manager"]);

  const isExpired =
    restaurant.subscription_status === "expired" ||
    (restaurant.subscription_end_date &&
      new Date(restaurant.subscription_end_date) < new Date());

  const isPro = hasProReports(restaurant.subscription_tier, restaurant.subscription_status);
  const defaultGranularity: ReportGranularity = "daily";

  const supabase = createClient();
  let initialData: ReportData;
  let initialError: string | null = null;

  try {
    initialData = await fetchReportData(supabase, restaurant.id, defaultGranularity);
  } catch (err) {
    console.error("reports page initial fetch:", err);
    initialError = err instanceof Error ? err.message : "Failed to load reports";
    const { start, end } = getDateRange(defaultGranularity);
    initialData = {
      kpi: {
        total_orders: 0,
        total_revenue: 0,
        avg_order_value: 0,
        top_item_name: "—",
        top_item_quantity: 0,
      },
      revenue: [],
      topItems: [],
      leastItems: [],
      peakHours: [],
      paymentSplit: [],
      waiterPerformance: [],
      meta: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        granularity: defaultGranularity,
      },
    };
  }

  return (
    <ReportsClient
      slug={restaurant.slug}
      restaurantName={restaurant.name}
      subscriptionTier={restaurant.subscription_tier}
      subscriptionStatus={restaurant.subscription_status}
      initialData={initialData}
      initialGranularity={defaultGranularity}
      initialError={initialError}
      isPro={isPro}
      isExpired={Boolean(isExpired)}
    />
  );
}
