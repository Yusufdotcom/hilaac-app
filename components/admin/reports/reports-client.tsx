"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BarChart3,
  FileSpreadsheet,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { BrandButton } from "@/components/admin/brand-button";
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
import { KpiCards } from "@/components/admin/reports/kpi-cards";
import { ReportCharts } from "@/components/admin/reports/report-charts";
import { ReportsSkeleton } from "@/components/admin/reports/report-skeletons";
import { exportReportsExcel, exportReportsPdf } from "@/components/admin/reports/export-utils";
import type { ReportData, ReportGranularity } from "@/lib/reports/types";
import {
  getAvailableGranularities,
  granularityLabel,
  formatDateRangeLabel,
} from "@/lib/reports/timeframes";

type ReportsClientProps = {
  slug: string;
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
  restaurantName,
  subscriptionTier,
  subscriptionStatus,
  initialData,
  initialGranularity,
  initialError = null,
  isPro: initialIsPro,
  isExpired,
}: ReportsClientProps) {
  const brandColor = useAdminBrandColor();
  const accent = resolveBrandColor(brandColor);
  const [granularity, setGranularity] = useState<ReportGranularity>(initialGranularity);
  const [data, setData] = useState<ReportData>(initialData);
  const [isPro, setIsPro] = useState(initialIsPro);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  const availableGranularities = getAvailableGranularities(
    subscriptionTier as "starter" | "pro" | "trial",
    isPro && !isExpired
  );

  const refetch = useCallback(
    async (nextGranularity: ReportGranularity) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/reports/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, granularity: nextGranularity }),
        });
        const json = (await res.json()) as {
          data?: ReportData;
          isPro?: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error ?? "Failed to load reports");
        if (!json.data) throw new Error("No report data returned");
        setData(json.data);
        if (typeof json.isPro === "boolean") setIsPro(json.isPro);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load reports";
        setError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    },
    [slug]
  );

  function handleGranularityChange(value: ReportGranularity) {
    setGranularity(value);
    refetch(value);
  }

  async function handleExportPdf() {
    if (!isPro || isExpired) return;
    setExportingPdf(true);
    try {
      await exportReportsPdf({ slug, restaurantName, data, isPro: true });
      toast.success("PDF downloaded");
    } catch (err) {
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

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0F172A]"
            style={{ color: accent }}
          >
            <BarChart3 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#0F172A]">Reports & Analytics</h1>
            <p className="text-sm text-[#64748B]">
              {restaurantName} · {formatDateRangeLabel(data.meta.startDate, data.meta.endDate)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[#64748B]">Timeframe</span>
            <Select value={granularity} onValueChange={(v) => handleGranularityChange(v as ReportGranularity)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableGranularities.map((g) => (
                  <SelectItem key={g} value={g}>
                    {granularityLabel(g)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={exportDisabled || exportingPdf}
              title={exportTitle}
              onClick={handleExportPdf}
              className="gap-2"
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
              disabled={exportDisabled || exportingExcel}
              title={exportTitle}
              onClick={handleExportExcel}
              className="gap-2"
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
          className="flex items-start gap-3 rounded-xl border px-4 py-3 text-sm text-[#0F172A]"
          style={{
            borderColor: brandColorWithAlpha(accent, 0.4),
            backgroundColor: brandColorWithAlpha(accent, 0.1),
          }}
        >
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent }} />
          <div>
            <p className="font-semibold">Upgrade to Pro for advanced analytics</p>
            <p className="mt-1 text-[#64748B]">
              Unlock weekly & biweekly timeframes, full charts, and exportable reports.{" "}
              <Link href={`/admin/${slug}/billing`} className="font-medium text-[#0F172A] underline">
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
          <Button type="button" variant="outline" size="sm" onClick={() => refetch(granularity)} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {loading ? (
        <ReportsSkeleton />
      ) : (
        <>
          <KpiCards kpi={data.kpi} />

          {isPro && !isExpired ? (
            <ReportCharts data={data} />
          ) : (
            <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-white px-6 py-16 text-center">
              <BarChart3 className="mx-auto h-10 w-10 text-[#94A3B8]" />
              <p className="mt-3 text-lg font-semibold text-[#0F172A]">Advanced charts are a Pro feature</p>
              <p className="mt-1 text-sm text-[#64748B]">
                Upgrade to visualize revenue trends, peak hours, payment splits, and waiter performance.
              </p>
              {!isExpired && (
                <BrandButton asChild className="mt-6 inline-flex rounded-full px-6 py-3 text-sm font-semibold">
                  <Link href={`/admin/${slug}/billing`}>Upgrade to Pro</Link>
                </BrandButton>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
