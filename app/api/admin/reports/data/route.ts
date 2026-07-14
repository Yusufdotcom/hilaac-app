import { NextRequest, NextResponse } from "next/server";
import { getVerifiedReportsContext } from "@/lib/reports/auth";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import type { ReportGranularity } from "@/lib/reports/types";
import { getAvailableGranularities, hasProReports } from "@/lib/reports/timeframes";

export const dynamic = "force-dynamic";

const GRANULARITIES: ReportGranularity[] = ["daily", "weekly", "biweekly", "monthly"];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { slug?: string; granularity?: string };
    const slug = body.slug;
    const granularity = body.granularity as ReportGranularity;

    if (!slug || !granularity || !GRANULARITIES.includes(granularity)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const ctx = await getVerifiedReportsContext(slug);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const isPro = hasProReports(ctx.restaurant.subscription_tier, ctx.restaurant.subscription_status);
    const allowed = getAvailableGranularities(ctx.restaurant.subscription_tier, isPro);
    if (!allowed.includes(granularity)) {
      return NextResponse.json({ error: "Timeframe not available on your plan" }, { status: 403 });
    }

    const data = await fetchReportData(ctx.supabase, ctx.restaurant.id, granularity);
    return NextResponse.json({ data, isPro });
  } catch (err) {
    console.error("reports/data error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load reports" },
      { status: 500 }
    );
  }
}
