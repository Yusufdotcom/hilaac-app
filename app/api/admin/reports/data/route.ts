import { NextRequest, NextResponse } from "next/server";
import { getVerifiedReportsContext } from "@/lib/reports/auth";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import type { ReportGranularity } from "@/lib/reports/types";
import { getAvailableGranularities, getAllGranularities, hasProReports } from "@/lib/reports/timeframes";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      slug?: string;
      granularity?: string;
      periodOffset?: number;
    };
    const slug = body.slug;
    const granularity = body.granularity as ReportGranularity;
    const periodOffset = Number.isFinite(body.periodOffset) ? Number(body.periodOffset) : 0;

    if (!slug || !granularity || !getAllGranularities().includes(granularity)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const ctx = await getVerifiedReportsContext(slug);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Never trust slug alone — restaurant_id must match authenticated access.
    if (!ctx.restaurant.id || ctx.restaurant.slug !== slug) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const isPro = hasProReports(ctx.restaurant.subscription_tier, ctx.restaurant.subscription_status);
    const allowed = getAvailableGranularities(ctx.restaurant.subscription_tier, isPro);
    if (!allowed.includes(granularity)) {
      return NextResponse.json({ error: "Timeframe not available on your plan" }, { status: 403 });
    }

    const data = await fetchReportData(ctx.supabase, ctx.restaurant.id, granularity, periodOffset);
    return NextResponse.json({
      data,
      isPro,
      restaurantId: ctx.restaurant.id,
    });
  } catch (err) {
    console.error("[reports/data] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load reports" },
      { status: 500 }
    );
  }
}
