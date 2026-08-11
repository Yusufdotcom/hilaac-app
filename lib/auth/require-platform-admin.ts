import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { requireAal2ForPlatformAdmin } from "@/lib/auth/aal";
import { createClient } from "@/lib/supabase/server";

export type PlatformAdminProfile = {
  id: string;
  is_active: boolean;
  is_platform_admin: boolean;
  restaurant_id: string | null;
  role: string;
};

export type RequirePlatformAdminOk = {
  ok: true;
  supabase: ReturnType<typeof createClient>;
  user: User;
  profile: PlatformAdminProfile;
};

export type RequirePlatformAdminFail = {
  ok: false;
  response: NextResponse;
};

/**
 * API / server gate for /platform/* and /api/platform/*.
 *
 * Independent of restaurant role / ownership:
 *   1) authenticated session
 *   2) profiles.is_platform_admin === true (and active)
 *   3) session AAL2 (MFA) — mandatory, no opt-out
 */
export async function requirePlatformAdmin(): Promise<
  RequirePlatformAdminOk | RequirePlatformAdminFail
> {
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
    .select("id, is_active, is_platform_admin, restaurant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  // Explicit flag check — restaurant owner/manager never satisfy this alone.
  if (!profile || profile.is_active === false || profile.is_platform_admin !== true) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const aal = await requireAal2ForPlatformAdmin(supabase);
  if (!aal.ok) return aal;

  return {
    ok: true,
    supabase,
    user,
    profile: profile as PlatformAdminProfile,
  };
}

/**
 * Server-component helper for /platform layout.
 * Same is_platform_admin gate; MFA is enforced in middleware for page routes.
 */
export async function getPlatformAdminSession(): Promise<{
  user: User;
  profile: PlatformAdminProfile;
} | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_active, is_platform_admin, restaurant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false || profile.is_platform_admin !== true) {
    return null;
  }

  return { user, profile: profile as PlatformAdminProfile };
}
