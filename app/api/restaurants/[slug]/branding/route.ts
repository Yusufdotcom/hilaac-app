import { NextResponse } from "next/server";
import { fetchRestaurantBrandingBySlug } from "@/lib/brand/fetch-restaurant-branding";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const branding = await fetchRestaurantBrandingBySlug(params.slug);

  if (!branding) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  return NextResponse.json(branding, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
