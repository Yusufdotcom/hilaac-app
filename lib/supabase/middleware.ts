import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and enforces
 * route protection for /admin/* and /staff/* + trial-expiration redirects.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = pathname.startsWith("/admin") || pathname.startsWith("/staff");

  // Never hit Postgres (profiles/restaurants) until the user is authenticated.
  if (!user) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectedFrom", pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (isProtected) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("restaurant_id, role")
      .eq("id", user.id)
      .maybeSingle();

    // Trial/subscription gate: only the owner/manager billing screens stay
    // reachable once a subscription has expired; everything else in /admin
    // bounces to /billing so the restaurant can upgrade.
    if (profile?.restaurant_id) {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("slug, subscription_status, subscription_end_date")
        .eq("id", profile.restaurant_id)
        .maybeSingle();

      const isExpired =
        restaurant?.subscription_status === "expired" ||
        (restaurant?.subscription_end_date && new Date(restaurant.subscription_end_date) < new Date());

      const isBillingRoute = pathname === `/admin/${restaurant?.slug}/billing`;

      if (isExpired && pathname.startsWith("/admin") && !isBillingRoute && restaurant?.slug) {
        const url = request.nextUrl.clone();
        url.pathname = `/admin/${restaurant.slug}/billing`;
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
