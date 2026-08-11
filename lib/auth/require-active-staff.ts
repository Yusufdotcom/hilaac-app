import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { readSupportSessionForUser } from "@/lib/platform/support-session-server";
import type { UserRole } from "@/types/database";

export type ActiveStaffProfile = {
  restaurant_id: string | null;
  role: UserRole;
  is_active: boolean;
  is_platform_admin?: boolean;
  /** Ephemeral: platform admin Open into a tenant (not written to profiles). */
  platform_support?: boolean;
};

export type RequireActiveStaffOk = {
  ok: true;
  supabase: ReturnType<typeof createClient>;
  user: User;
  profile: ActiveStaffProfile;
};

export type RequireActiveStaffFail = {
  ok: false;
  response: NextResponse;
};

/**
 * API gate for /api/admin/* — requires an authenticated, active profile.
 * Middleware only covers /admin and /staff pages, not API routes.
 *
 * Platform admins may act on a tenant only with a valid support-session cookie
 * (minted by GET /platform/open/[slug] after is_platform_admin + AAL2).
 */
export async function requireActiveStaff(options?: {
  roles?: readonly UserRole[] | UserRole[];
  requireRestaurant?: boolean;
}): Promise<RequireActiveStaffOk | RequireActiveStaffFail> {
  const roles = options?.roles;
  const requireRestaurant = options?.requireRestaurant !== false;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("restaurant_id, role, is_active, is_platform_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const isPlatformAdmin = profile.is_platform_admin === true;
  const support = isPlatformAdmin ? await readSupportSessionForUser(user.id) : null;

  let restaurantId = profile.restaurant_id as string | null;
  let role = profile.role as UserRole;
  let platformSupport = false;

  if (support) {
    restaurantId = support.restaurantId;
    role = "owner";
    platformSupport = true;
  }

  if (requireRestaurant && !restaurantId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: isPlatformAdmin
            ? "Open a restaurant from the Platform console first"
            : "Forbidden",
          code: isPlatformAdmin ? "platform_support_required" : "forbidden",
        },
        { status: 403 }
      ),
    };
  }

  if (roles && !roles.includes(role)) {
    // Platform support synthesizes owner; dedicated platform accounts also use role owner.
    if (!(isPlatformAdmin && platformSupport && roles.includes("owner"))) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
  }

  return {
    ok: true,
    supabase,
    user,
    profile: {
      restaurant_id: restaurantId,
      role,
      is_active: true,
      is_platform_admin: isPlatformAdmin,
      platform_support: platformSupport,
    },
  };
}
