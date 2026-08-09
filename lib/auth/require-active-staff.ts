import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/database";

export type ActiveStaffProfile = {
  restaurant_id: string | null;
  role: UserRole;
  is_active: boolean;
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
    .select("restaurant_id, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (requireRestaurant && !profile.restaurant_id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  if (roles && !roles.includes(profile.role as UserRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    ok: true,
    supabase,
    user,
    profile: profile as ActiveStaffProfile,
  };
}
