import { getVerifiedReportsContext } from "@/lib/reports/auth";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import { hasProReports, getDateRange } from "@/lib/reports/timeframes";
import { ReportsClient } from "@/components/admin/reports/reports-client";
import type { ReportData, ReportGranularity } from "@/lib/reports/types";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

function emptyReport(granularity: ReportGranularity): ReportData {
  const { start, end } = getDateRange(granularity, 0);
  const flat = { percent: 0 as number | null, direction: "flat" as const, current: 0, previous: 0 };
  return {
    kpi: {
      total_orders: 0,
      total_revenue: 0,
      avg_order_value: 0,
      top_item_name: null,
      top_item_quantity: 0,
      trends: { orders: flat, revenue: flat, aov: flat },
    },
    revenue: [],
    previousRevenue: [],
    topItems: [],
    leastItems: [],
    peakHours: [],
    peakDays: [],
    paymentSplit: [
      { payment_method: "EVC", order_count: 0, revenue: 0 },
      { payment_method: "eDahab", order_count: 0, revenue: 0 },
      { payment_method: "Cash", order_count: 0, revenue: 0 },
    ],
    waiterPerformance: [],
    spikedItems: [],
    meta: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      granularity,
      periodOffset: 0,
    },
  };
}

export default async function ReportsPage({ params }: { params: { slug: string } }) {
  const ctx = await getVerifiedReportsContext(params.slug);
  if (!ctx) redirect("/login");

  const { restaurant } = ctx;

  // Never authorize from slug alone — context already matched auth user → restaurant_id.
  if (!restaurant.id || restaurant.slug !== params.slug) {
    redirect("/login");
  }

  const isExpired =
    restaurant.subscription_status === "expired" ||
    (restaurant.subscription_end_date != null &&
      new Date(restaurant.subscription_end_date) < new Date());

  const isPro = hasProReports(restaurant.subscription_tier, restaurant.subscription_status);
  const defaultGranularity: ReportGranularity = "daily";

  let initialData: ReportData;
  let initialError: string | null = null;

  try {
    initialData = await fetchReportData(ctx.supabase, restaurant.id, defaultGranularity, 0);
  } catch (err) {
    console.error("[reports/page] initial fetch failed", {
      restaurantId: restaurant.id,
      slug: params.slug,
      error: err instanceof Error ? err.message : err,
    });
    initialError = err instanceof Error ? err.message : "Failed to load reports";
    initialData = emptyReport(defaultGranularity);
  }

  return (
    <ReportsClient
      slug={restaurant.slug}
      restaurantId={restaurant.id}
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
