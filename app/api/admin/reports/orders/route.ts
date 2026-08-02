import { NextRequest, NextResponse } from "next/server";
import { getVerifiedReportsContext } from "@/lib/reports/auth";
import { fetchExportOrders } from "@/lib/reports/fetch-report-data";
import { requireAal2ForPrivilegedRole } from "@/lib/auth/aal";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug");
    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");
    const limitParam = req.nextUrl.searchParams.get("limit");

    if (!slug || !startDate || !endDate) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const ctx = await getVerifiedReportsContext(slug);
    if (!ctx) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Order export includes customer phone numbers — require AAL2 for owner/manager.
    const aal = await requireAal2ForPrivilegedRole(ctx.supabase, ctx.profile.role);
    if (!aal.ok) return aal.response;

    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const orders = await fetchExportOrders(
      ctx.supabase,
      ctx.restaurant.id,
      startDate,
      endDate,
      limit
    );

    return NextResponse.json({ orders });
  } catch (err) {
    console.error("reports/orders error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load orders" },
      { status: 500 }
    );
  }
}
