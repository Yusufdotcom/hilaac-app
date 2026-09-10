import { NextRequest, NextResponse } from "next/server";
import { requireAal2ForPrivilegedRole } from "@/lib/auth/aal";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { getVerifiedReportsContext } from "@/lib/reports/auth";
import {
  fetchLibraryReport,
  LIBRARY_REPORT_IDS,
  type LibraryReportId,
} from "@/lib/reports/fetch-library-report";
import type { TierFeature } from "@/lib/billing/tier-capabilities";

export const dynamic = "force-dynamic";

const REPORT_GATES: Partial<Record<LibraryReportId, TierFeature>> = {
  profitability: "expenses_pnl",
  expenses: "expenses_pnl",
  employees: "staff_performance",
  customers: "customer_intelligence",
  waste: "inventory",
  menu: "menu_profitability",
  weekly_sales: "advanced_reports",
  locations: "multi_branch_comparison",
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { slug?: string; reportId?: string };
    const slug = body.slug?.trim();
    const reportId = body.reportId as LibraryReportId | undefined;

    if (!slug || !reportId || !LIBRARY_REPORT_IDS.includes(reportId)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const ctx = await getVerifiedReportsContext(slug);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const aal = await requireAal2ForPrivilegedRole(ctx.supabase, ctx.profile.role);
    if (!aal.ok) return aal.response;

    const gate = REPORT_GATES[reportId];
    if (gate && !canUseFeature(ctx.restaurant.subscription_tier, gate)) {
      return NextResponse.json(
        { error: "Not available on your plan", code: "tier_gated" },
        { status: 403 }
      );
    }

    const data = await fetchLibraryReport(ctx.supabase, ctx.restaurant.id, reportId);
    return NextResponse.json({ data, restaurantName: ctx.restaurant.name });
  } catch (err) {
    console.error("[reports/library]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load report" },
      { status: 500 }
    );
  }
}
