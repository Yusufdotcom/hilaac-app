import { NextRequest, NextResponse } from "next/server";
import { requireAal2ForPrivilegedRole } from "@/lib/auth/aal";
import { canUseFeature } from "@/lib/billing/tier-capabilities";
import { getVerifiedReportsContext } from "@/lib/reports/auth";
import { fetchBranchComparison } from "@/lib/reports/fetch-branch-comparison";
import type { ReportGranularity } from "@/lib/reports/types";
import { getAllGranularities } from "@/lib/reports/timeframes";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { slug?: string; granularity?: string };
    const slug = body.slug?.trim();
    const granularity = (body.granularity as ReportGranularity) || "monthly";

    if (!slug || !getAllGranularities().includes(granularity)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const ctx = await getVerifiedReportsContext(slug);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const aal = await requireAal2ForPrivilegedRole(ctx.supabase, ctx.profile.role);
    if (!aal.ok) return aal.response;

    if (!canUseFeature(ctx.restaurant.subscription_tier, "multi_branch_comparison")) {
      return NextResponse.json(
        { error: "Multi-branch comparison requires Gorgor or higher", code: "tier_gated" },
        { status: 403 }
      );
    }

    const ownerId = ctx.restaurant.owner_id;
    if (!ownerId) {
      return NextResponse.json({ error: "No owner on restaurant" }, { status: 400 });
    }

    const rows = await fetchBranchComparison(ctx.supabase, ownerId, granularity);
    return NextResponse.json({ rows, granularity });
  } catch (err) {
    console.error("[reports/locations]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load locations" },
      { status: 500 }
    );
  }
}
