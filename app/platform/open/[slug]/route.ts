import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { createAdminClient } from "@/lib/supabase/server";
import {
  applySupportCookie,
  mintPlatformSupportToken,
} from "@/lib/platform/support-session";

/**
 * GET /platform/open/[slug]
 *
 * Platform Super Admin only (is_platform_admin + AAL2 via requirePlatformAdmin).
 * Mints a short-lived support cookie bound to this user + restaurant, then
 * redirects into /admin/[slug]/dashboard — without writing restaurant_id on the profile.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) {
    if (auth.response.status === 401) {
      return NextResponse.redirect(new URL("/login", _req.url));
    }
    if (auth.response.status === 403) {
      const body = await auth.response.clone().json().catch(() => ({}));
      if (body?.code === "aal2_required" || body?.code === "aal_check_failed") {
        const next = encodeURIComponent(`/platform/open/${params.slug}`);
        const path =
          body?.nextLevel === "aal1" || body?.code === "aal_check_failed"
            ? "/auth/mfa/enroll"
            : "/auth/mfa/challenge";
        return NextResponse.redirect(new URL(`${path}?next=${next}`, _req.url));
      }
      return NextResponse.redirect(new URL("/login?error=forbidden", _req.url));
    }
    return auth.response;
  }

  const slug = params.slug?.trim();
  if (!slug) {
    return NextResponse.redirect(new URL("/platform/restaurants", _req.url));
  }

  const admin = createAdminClient();
  const { data: restaurant, error } = await admin
    .from("restaurants")
    .select("id, slug, owner_id, name")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !restaurant) {
    return NextResponse.redirect(new URL("/platform/restaurants?error=not_found", _req.url));
  }

  // Refuse to open a restaurant the platform admin somehow owns as a "cross-tenant"
  // path still works; ownership is irrelevant — support cookie is always set.
  const token = await mintPlatformSupportToken(auth.user.id, restaurant.id, restaurant.slug);
  const destination = new URL(`/admin/${restaurant.slug}/dashboard`, _req.url);
  const res = NextResponse.redirect(destination);
  applySupportCookie(res, token);

  console.info("[platform] support_open", {
    platformUserId: auth.user.id,
    restaurantId: restaurant.id,
    slug: restaurant.slug,
    ownerId: restaurant.owner_id,
    crossTenant: restaurant.owner_id !== auth.user.id,
  });

  return res;
}
