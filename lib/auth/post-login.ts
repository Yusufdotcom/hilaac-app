import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import { roleRequiresMfa, MFA_EXEMPT_ROLES } from "@/lib/auth/roles";

export type PostLoginProfile = {
  role: string;
  restaurant_id: string | null;
  is_active: boolean;
  is_platform_admin: boolean;
};

export async function loadPostLoginProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<PostLoginProfile | null> {
  const { data: authProfile } = await supabase
    .from("profiles")
    .select("role, restaurant_id, is_active, is_platform_admin")
    .eq("id", userId)
    .maybeSingle();

  let profile = authProfile;
  if (!profile) {
    const admin = createAdminClient();
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("role, restaurant_id, is_active, is_platform_admin")
      .eq("id", userId)
      .maybeSingle();
    profile = adminProfile;
  }

  if (!profile) return null;
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

function mfaGatePath(
  aal: { currentLevel: string | null; nextLevel: string | null } | null,
  aalError: { message?: string } | null,
  destination: string
): string | null {
  // Fail-closed: missing AAL must not skip MFA for platform / owner / manager.
  if (aalError || !aal) {
    return `/auth/mfa/enroll?next=${encodeURIComponent(destination)}`;
  }
  if (aal.currentLevel === "aal1" && aal.nextLevel === "aal2") {
    return `/auth/mfa/challenge?next=${encodeURIComponent(destination)}`;
  }
  if (aal.nextLevel === "aal1") {
    return `/auth/mfa/enroll?next=${encodeURIComponent(destination)}`;
  }
  return null;
}

/**
 * After password/OAuth session exists: MFA enroll/challenge, then dashboard or platform.
 * Platform-only accounts (is_platform_admin, no restaurant) go to /platform/restaurants.
 * Platform MFA is unconditional.
 */
export async function resolvePostAuthRedirect(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const profile = await loadPostLoginProfile(supabase, userId);
  if (!profile) return "/auth/complete-signup";
  if (profile.is_active === false) return "/login?error=deactivated";

  const isPlatformAdmin = profile.is_platform_admin === true;
  const platformHome = "/platform/restaurants";

  // Dedicated platform owner: no restaurant ownership required.
  if (isPlatformAdmin && !profile.restaurant_id) {
    const { data: aal, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const gate = mfaGatePath(aal, aalError, platformHome);
    return gate ?? platformHome;
  }

  if (!profile.restaurant_id) return "/auth/complete-signup";

  const slug = await resolveRestaurantSlug(supabase, profile.restaurant_id);
  if (!slug) return "/login?error=no-restaurant";

  // Hybrid accounts (flag + restaurant) keep tenant admin as post-login home.
  const destination = dashboardPathForRole(profile.role, slug);

  // Platform admins always MFA; owners/managers MFA by role.
  if (!isPlatformAdmin && !roleRequiresMfa(profile.role)) {
    return destination;
  }

  const { data: aal, error: aalError } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const gate = mfaGatePath(aal, aalError, destination);
  return gate ?? destination;
}
