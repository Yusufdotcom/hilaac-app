"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Loader2,
  Lock,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminBrandColor } from "@/components/admin/admin-brand-context";
import { brandColorWithAlpha, resolveBrandColor } from "@/lib/brand/restaurant-brand";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCards } from "@/components/admin/reports/kpi-cards";
import {
  MenuPerformancePanel,
  RevenueDeepDivePanel,
  RevenueTrendPanel,
  StaffPerformancePanel,
  TrafficTimingPanel,
} from "@/components/admin/reports/report-charts";
import { ReportsSkeleton } from "@/components/admin/reports/report-skeletons";
import { exportReportsExcel, exportReportsPdf } from "@/components/admin/reports/export-utils";
import type { ReportData, ReportGranularity } from "@/lib/reports/types";
import {
  getAvailableGranularities,
  getAllGranularities,
  granularityLabel,
  formatDateRangeLabel,
} from "@/lib/reports/timeframes";

type ReportsClientProps = {
  slug: string;
  restaurantId: string;
  restaurantName: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  initialData: ReportData;
  initialGranularity: ReportGranularity;
  initialError?: string | null;
  isPro: boolean;
  isExpired: boolean;
};

export function ReportsClient({
  slug,
  restaurantId,
  restaurantName,
  subscriptionTier,
  subscriptionStatus: _subscriptionStatus,
  initialData,
  initialGranularity,
  initialError = null,
  isPro: initialIsPro,
  isExpired,
}: ReportsClientProps) {
  const brandColor = useAdminBrandColor();
  const accent = resolveBrandColor(brandColor);
  const [granularity, setGranularity] = useState<ReportGranularity>(initialGranularity);
  const [periodOffset, setPeriodOffset] = useState(0);
  const [data, setData] = useState<ReportData>(initialData);
  const [isPro, setIsPro] = useState(initialIsPro);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [hasCountedUp, setHasCountedUp] = useState(false);
  const [tab, setTab] = useState("overview");
  const [showPrevious, setShowPrevious] = useState(true);

  const availableGranularities = getAvailableGranularities(
    subscriptionTier as "starter" | "pro" | "trial",
    isPro && !isExpired
  );
  const allGranularities = getAllGranularities();

  const refetch = useCallback(
    async (nextGranularity: ReportGranularity, nextOffset: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/reports/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slug,
            granularity: nextGranularity,
            periodOffset: nextOffset,
          }),
        });
        const json = (await res.json()) as {
          data?: ReportData;
          isPro?: boolean;
          restaurantId?: string;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Failed to load reports");
        if (!json.data) throw new Error("No report data returned");
        if (json.restaurantId && json.restaurantId !== restaurantId) {
          throw new Error("Restaurant mismatch — refresh and try again");
        }
        setData(json.data);
        if (typeof json.isPro === "boolean") setIsPro(json.isPro);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load reports";
        console.error("[reports] refetch failed", {
          slug,
          restaurantId,
          granularity: nextGranularity,
          periodOffset: nextOffset,
          error: message,
        });
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [slug, restaurantId]
  );

  function handleGranularityChange(value: ReportGranularity) {
    if (!availableGranularities.includes(value)) {
      toast.message("Upgrade to Pro to unlock this timeframe", {
        description: `${granularityLabel(value)} reporting is available on Pro.`,
        action: {
          label: "Billing",
          onClick: () => {
            window.location.href = `/admin/${slug}/billing`;
          },
        },
      });
      return;
    }
    setGranularity(value);
    setPeriodOffset(0);
    refetch(value, 0);
  }

  function stepPeriod(delta: number) {
    const next = periodOffset + delta;
    if (next > 0) return;
    setPeriodOffset(next);
    refetch(granularity, next);
  }

  async function handleExportPdf() {
    if (!isPro || isExpired) return;
    setExportingPdf(true);
    try {
      await exportReportsPdf({ slug, restaurantName, data, isPro: true });
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("[reports] PDF export failed", { slug, error: err });
      toast.error(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setExportingPdf(false);
    }
  }

  async function handleExportExcel() {
    if (!isPro || isExpired) return;
    setExportingExcel(true);
    try {
      await exportReportsExcel({ slug, restaurantName, data, isPro: true });
      toast.success("Excel downloaded");
    } catch (err) {
      console.error("[reports] Excel export failed", { slug, error: err });
      toast.error(err instanceof Error ? err.message : "Excel export failed");
    } finally {
      setExportingExcel(false);
    }
  }

  const exportDisabled = !isPro || isExpired;
  const exportTitle = exportDisabled
    ? isExpired
      ? "Renew your subscription to export analytics"
      : "Upgrade to Pro to export full analytics"
    : undefined;

  const isEmpty =
    !loading &&
    !error &&
    data.kpi.total_orders === 0 &&
    data.kpi.total_revenue === 0 &&
    data.revenue.every((r) => Number(r.revenue) === 0);

  const rangeLabel = formatDateRangeLabel(data.meta.startDate, data.meta.endDate);

  return (
    <div className="-mx-4 min-h-full bg-slate-50 px-4 pb-8 pt-0 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="sticky top-0 z-30 -mx-4 border-b border-slate-200/80 bg-slate-50/95 px-4 py-4 backdrop-blur supports-[backdrop-filter]:bg-slate-50/80 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <header className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Insights</h1>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              <button
                type="button"
                aria-label="Previous period"
                disabled={loading}
                onClick={() => stepPeriod(-1)}
                className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-0 truncate font-medium">{rangeLabel}</span>
              <button
                type="button"
                aria-label="Next period"
                disabled={loading || periodOffset >= 0}
                onClick={() => stepPeriod(1)}
                className="rounded-md p-1 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-500">Timeframe</span>
              <Select
                value={granularity}
                onValueChange={(v) => handleGranularityChange(v as ReportGranularity)}
              >
                <SelectTrigger className="w-[168px] bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allGranularities.map((g) => {
                    const locked = !availableGranularities.includes(g);
                    return (
                      <SelectItem key={g} value={g}>
                        <span
                          className="inline-flex items-center gap-2"
                          title={
                            locked
                              ? "Upgrade to Pro to unlock this timeframe"
                              : undefined
                          }
                        >
                          {granularityLabel(g)}
                          {locked && (
                            <Lock className="h-3 w-3 text-slate-400" aria-hidden="true" />
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={exportDisabled || exportingPdf || loading}
                title={exportTitle}
                onClick={handleExportPdf}
                className="gap-2 bg-white"
              >
                {exportingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                Download PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={exportDisabled || exportingExcel || loading}
                title={exportTitle}
                onClick={handleExportExcel}
                className="gap-2 bg-white"
              >
                {exportingExcel ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
                Download Excel
              </Button>
            </div>
          </div>
        </header>
      </div>

      <div className="mt-6 space-y-6">
        {isExpired && (
          <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Subscription expired</p>
              <p className="mt-1">
                Renew your plan to access advanced analytics and exports.{" "}
                <Link href={`/admin/${slug}/billing`} className="font-medium underline">
                  Go to Billing
                </Link>
              </p>
            </div>
          </div>
        )}

        {!isPro && !isExpired && (
          <div
            className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm text-slate-900"
            style={{
              borderColor: brandColorWithAlpha(accent, 0.4),
              backgroundColor: brandColorWithAlpha(accent, 0.1),
            }}
          >
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent }} />
            <div>
              <p className="font-semibold">Upgrade to Pro for advanced analytics</p>
              <p className="mt-1 text-slate-500">
                Unlock weekly, biweekly & yearly timeframes plus PDF/Excel exports.{" "}
                <Link href={`/admin/${slug}/billing`} className="font-medium text-slate-900 underline">
                  Upgrade now
                </Link>
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{error}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch(granularity, periodOffset)}
              className="gap-2 bg-white"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        )}

        {loading ? (
          <ReportsSkeleton />
        ) : (
          !error && (
            <>
              <KpiCards
                kpi={data.kpi}
                animateEntrance={!hasCountedUp}
                onEntranceComplete={() => setHasCountedUp(true)}
              />

              {isEmpty ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
                    <Sparkles className="h-8 w-8 text-slate-400" aria-hidden="true" />
                  </div>
                  <p className="text-lg font-semibold text-slate-900">No data available</p>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    No data available for this period.
                  </p>
                </div>
              ) : (
                <Tabs
                  value={tab}
                  onValueChange={setTab}
                  className="w-full min-w-0 space-y-4"
                >
                  <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-white p-1 shadow-sm">
                    <TabsTrigger value="overview" className="text-xs sm:text-sm">
                      Overview
                    </TabsTrigger>
                    <TabsTrigger value="revenue" className="text-xs sm:text-sm">
                      Revenue
                    </TabsTrigger>
                    <TabsTrigger value="menu" className="text-xs sm:text-sm">
                      Menu Performance
                    </TabsTrigger>
                    <TabsTrigger value="traffic" className="text-xs sm:text-sm">
                      Traffic & Timing
                    </TabsTrigger>
                    <TabsTrigger value="staff" className="text-xs sm:text-sm">
                      Staff Performance
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="overview"
                    className="mt-0 space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                  >
                    <RevenueTrendPanel
                      data={data}
                      showPrevious={showPrevious}
                      onShowPreviousChange={setShowPrevious}
                      compact
                    />
                  </TabsContent>

                  <TabsContent
                    value="revenue"
                    className="mt-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                  >
                    <RevenueDeepDivePanel
                      data={data}
                      showPrevious={showPrevious}
                      onShowPreviousChange={setShowPrevious}
                    />
                  </TabsContent>

                  <TabsContent
                    value="menu"
                    className="mt-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                  >
                    <MenuPerformancePanel data={data} />
                  </TabsContent>

                  <TabsContent
                    value="traffic"
                    className="mt-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                  >
                    <TrafficTimingPanel
                      data={data}
                      showPrevious={showPrevious}
                      onShowPreviousChange={setShowPrevious}
                    />
                  </TabsContent>

                  <TabsContent
                    value="staff"
                    className="mt-0 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                  >
                    <StaffPerformancePanel
                      data={data}
                      onRetryWaiter={() => refetch(granularity, periodOffset)}
                    />
                  </TabsContent>
                </Tabs>
              )}
            </>
          )
        )}
      </div>

    </div>
  );
}
