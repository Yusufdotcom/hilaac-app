import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { roleRequiresMfa, MFA_EXEMPT_ROLES } from "@/lib/auth/roles";

export type PostLoginProfile = {
  role: string;
  restaurant_id: string;
  is_active: boolean;
};

export async function loadPostLoginProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<PostLoginProfile | null> {
  const { data: authProfile } = await supabase
    .from("profiles")
    .select("role, restaurant_id, is_active")
    .eq("id", userId)
    .maybeSingle();

  let profile = authProfile;
  if (!profile?.restaurant_id) {
    const admin = createAdminClient();
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("role, restaurant_id, is_active")
      .eq("id", userId)
      .maybeSingle();
    profile = adminProfile;
  }

  if (!profile?.restaurant_id) return null;
  return profile as PostLoginProfile;
}

export async function resolveRestaurantSlug(
  supabase: SupabaseClient,
  restaurantId: string
): Promise<string | null> {
  const { data } = await supabase.from("restaurants").select("slug").eq("id", restaurantId).maybeSingle();
  if (data?.slug) return data.slug;

  const admin = createAdminClient();
  const { data: adminRestaurant } = await admin
    .from("restaurants")
    .select("slug")
    .eq("id", restaurantId)
    .maybeSingle();
  return adminRestaurant?.slug ?? null;
}

export function dashboardPathForRole(role: string, slug: string): string {
  if (MFA_EXEMPT_ROLES.includes(role as (typeof MFA_EXEMPT_ROLES)[number])) {
    const segment = role === "kitchen" ? "kitchen" : role;
    return `/staff/${slug}/${segment}`;
  }
  return `/admin/${slug}/dashboard`;
}

/**
 * After password/OAuth session exists: MFA enroll/challenge for owner/manager, else dashboard.
 */
export async function resolvePostAuthRedirect(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const profile = await loadPostLoginProfile(supabase, userId);
  if (!profile) return "/auth/complete-signup";
  if (profile.is_active === false) return "/login?error=deactivated";

  const slug = await resolveRestaurantSlug(supabase, profile.restaurant_id);
  if (!slug) return "/login?error=no-restaurant";

  const destination = dashboardPathForRole(profile.role, slug);

  if (!roleRequiresMfa(profile.role)) {
    return destination;
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal) return destination;

  // MFA enrolled but this session is only aal1 → challenge
  if (aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
    return `/auth/mfa/challenge?next=${encodeURIComponent(destination)}`;
  }

  // No MFA enrolled yet → first-login enrollment
  if (aal.nextLevel === "aal1") {
    return `/auth/mfa/enroll?next=${encodeURIComponent(destination)}`;
  }

  return destination;
}
