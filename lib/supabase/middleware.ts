import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { roleRequiresMfa } from "@/lib/auth/roles";
import {
  readStaffPinSessionFromRequest,
  STAFF_PIN_COOKIE,
} from "@/lib/auth/staff-pin-session";
import {
  PLATFORM_SUPPORT_COOKIE,
  readSupportSessionFromRequest,
} from "@/lib/platform/support-session";

/**
 * Refreshes the Supabase auth session on every request.
 * Login is required ONLY for /admin/* , /staff/* , and /platform/*.
 * Public QR ordering (/order/*) and other public routes never redirect to /login.
 *
 * Staff PIN: /staff/[slug]/pin and /api/staff/pin/* are public; other /staff/*
 * pages accept a valid PIN cookie instead of email login.
 *
 * MFA:
 *   - is_platform_admin → unconditional on /platform and while in tenant support Open
 *   - owner/manager → on /admin (existing)
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const pathname = request.nextUrl.pathname;
  const isPlatform = pathname.startsWith("/platform");
  const isStaffPinPage = /^\/staff\/[^/]+\/pin\/?$/.test(pathname);
  const isStaffPinApi = pathname.startsWith("/api/staff/pin/");
  const isStaffRoute = pathname.startsWith("/staff");
  const isProtected =
    pathname.startsWith("/admin") ||
    (isStaffRoute && !isStaffPinPage) ||
    isPlatform;
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

  // PIN entry + PIN APIs are public (shared tablets).
  if (isStaffPinPage || isStaffPinApi) {
    return supabaseResponse;
  }

  // Public routes (including /order/[slug] QR pages) — never require auth.
  if (!user) {
    if (isStaffRoute) {
      const pinSession = await readStaffPinSessionFromRequest(request);
      const slugMatch = pathname.match(/^\/staff\/([^/]+)/);
      const slug = slugMatch?.[1];
      if (pinSession && slug && pinSession.slug === slug) {
        const roleSeg = pathname.match(/^\/staff\/[^/]+\/(kitchen|waiter|cashier)/)?.[1];
        if (roleSeg && roleSeg !== pinSession.role) {
          const url = request.nextUrl.clone();
          url.pathname = `/staff/${slug}/${pinSession.role}`;
          url.search = "";
          return NextResponse.redirect(url);
        }
        return supabaseResponse;
      }
      if (slug) {
        const url = request.nextUrl.clone();
        url.pathname = `/staff/${slug}/pin`;
        const roleSeg = pathname.match(/^\/staff\/[^/]+\/(kitchen|waiter|cashier)/)?.[1];
        url.search = "";
        if (roleSeg) url.searchParams.set("role", roleSeg);
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
    }
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirectedFrom", pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  if (isProtected || isStaffRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("restaurant_id, role, is_active, is_platform_admin")
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

    const isPlatformAdmin = profile.is_platform_admin === true;

    // --- MFA helper (fail-closed) ---
    const enforceMfa = async (): Promise<NextResponse | null> => {
      if (isMfaRoute) return null;
      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const nextParam = encodeURIComponent(pathname + request.nextUrl.search);
      if (aalError || !aal) {
        const url = request.nextUrl.clone();
        url.pathname = "/auth/mfa/enroll";
        url.search = `?next=${nextParam}`;
        return NextResponse.redirect(url);
      }
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
      return null;
    };

    // Platform Super Admin routes — never restaurant-role based.
    // Non–platform-admins (incl. restaurant owners) never see /platform — soft redirect to /admin.
    if (isPlatform) {
      if (!isPlatformAdmin) {
        const url = request.nextUrl.clone();
        url.pathname = "/admin";
        url.search = "";
        return NextResponse.redirect(url);
      }
      const mfaRedirect = await enforceMfa();
      if (mfaRedirect) return mfaRedirect;
      if (!pathname.startsWith("/platform/open")) {
        supabaseResponse.cookies.set(PLATFORM_SUPPORT_COOKIE, "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
      }
      return supabaseResponse;
    }

    if (
      pathname.startsWith("/admin") &&
      (isPlatformAdmin || roleRequiresMfa(profile.role))
    ) {
      const mfaRedirect = await enforceMfa();
      if (mfaRedirect) return mfaRedirect;
    }

    const adminSlugMatch = pathname.match(/^\/admin\/([^/]+)/);
    const urlSlug = adminSlugMatch?.[1];
    const support = isPlatformAdmin
      ? await readSupportSessionFromRequest(request, user.id)
      : null;

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
        const isPlatformSupport =
          support?.slug === urlSlug && support.restaurantId === urlRestaurant.id;
        if (isOwnerBranch || isProfileRestaurant || isPlatformSupport) {
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

    if (
      isPlatformAdmin &&
      !profile.restaurant_id &&
      pathname.startsWith("/admin") &&
      !support
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/platform/restaurants";
      return NextResponse.redirect(url);
    }

    if (restaurant) {
      const isExpired =
        restaurant.subscription_status === "expired" ||
        (restaurant.subscription_end_date &&
          new Date(restaurant.subscription_end_date) < new Date());

      const isBillingRoute = pathname === `/admin/${restaurant.slug}/billing`;
      const skipExpiryRedirect = Boolean(support && support.slug === restaurant.slug);

      if (
        isExpired &&
        pathname.startsWith("/admin") &&
        !isBillingRoute &&
        restaurant.slug &&
        !skipExpiryRedirect
      ) {
        const url = request.nextUrl.clone();
        url.pathname = `/admin/${restaurant.slug}/billing`;
        return NextResponse.redirect(url);
      }
    }
  }

  // Full email login on staff routes clears a PIN cookie that belongs to someone else.
  // Keep matching PIN cookie so the Lock control still appears for tablet sessions.
  if (isStaffRoute && user && request.cookies.get(STAFF_PIN_COOKIE)?.value) {
    const pin = await readStaffPinSessionFromRequest(request);
    if (!pin || pin.profileId !== user.id) {
      supabaseResponse.cookies.set(STAFF_PIN_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
  }

  return supabaseResponse;
}
