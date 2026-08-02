import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { roleRequiresMfa } from "@/lib/auth/roles";

/**
 * Refreshes the Supabase auth session on every request.
 * Login is required ONLY for /admin/* and /staff/*.
 * Public QR ordering (/order/*) and other public routes never redirect to /login.
 * Owner/manager on /admin must complete MFA enroll / AAL2 challenge.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;
  const isProtected = pathname.startsWith("/admin") || pathname.startsWith("/staff");
  const isMfaRoute = pathname.startsWith("/auth/mfa");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // Fail soft when env is missing: still gate protected pages, never crash public APIs.
  if (!supabaseUrl || !supabaseAnonKey) {
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectedFrom", pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes (including /order/[slug] QR pages) — never require auth.
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
      .select("restaurant_id, role, is_active")
      .eq("id", user.id)
      .maybeSingle();

    // H4: inactive / banned staff lose /admin and /staff even with a live JWT.
    if (!profile || profile.is_active === false) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "deactivated");
      url.searchParams.set("redirectedFrom", pathname);
      return NextResponse.redirect(url);
    }

    // MFA: owner/manager only — never kitchen/waiter/cashier (shared tablets).
    if (pathname.startsWith("/admin") && roleRequiresMfa(profile.role) && !isMfaRoute) {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal) {
        const nextParam = encodeURIComponent(pathname + request.nextUrl.search);
        if (aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
          const url = request.nextUrl.clone();
          url.pathname = "/auth/mfa/challenge";
          url.search = `?next=${nextParam}`;
          return NextResponse.redirect(url);
        }
        if (aal.nextLevel === "aal1") {
          const url = request.nextUrl.clone();
          url.pathname = "/auth/mfa/enroll";
          url.search = `?next=${nextParam}`;
          return NextResponse.redirect(url);
        }
      }
    }

    const adminSlugMatch = pathname.match(/^\/admin\/([^/]+)/);
    const urlSlug = adminSlugMatch?.[1];

    let restaurant:
      | { slug: string; subscription_status: string | null; subscription_end_date: string | null }
      | null = null;

    if (urlSlug) {
      const { data: urlRestaurant } = await supabase
        .from("restaurants")
        .select("id, slug, subscription_status, subscription_end_date, owner_id")
        .eq("slug", urlSlug)
        .maybeSingle();

      if (urlRestaurant) {
        const isOwnerBranch = profile?.role === "owner" && urlRestaurant.owner_id === user.id;
        const isProfileRestaurant = urlRestaurant.id === profile?.restaurant_id;
        if (isOwnerBranch || isProfileRestaurant) {
          restaurant = urlRestaurant;
        }
      }
    }

    if (!restaurant && profile?.restaurant_id) {
      const { data: profileRestaurant } = await supabase
        .from("restaurants")
        .select("slug, subscription_status, subscription_end_date")
        .eq("id", profile.restaurant_id)
        .maybeSingle();
      restaurant = profileRestaurant;
    }

    if (restaurant) {
      const isExpired =
        restaurant.subscription_status === "expired" ||
        (restaurant.subscription_end_date && new Date(restaurant.subscription_end_date) < new Date());

      const isBillingRoute = pathname === `/admin/${restaurant.slug}/billing`;

      if (isExpired && pathname.startsWith("/admin") && !isBillingRoute && restaurant.slug) {
        const url = request.nextUrl.clone();
        url.pathname = `/admin/${restaurant.slug}/billing`;
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
