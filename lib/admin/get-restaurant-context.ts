import { redirect, notFound } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Profile, Restaurant } from "@/types/database";
import { getUserRestaurantContext } from "@/lib/admin/resolve-user-restaurant";
import { ownerCanAccessSlug } from "@/lib/admin/owner-branches";
import { readSupportSessionForUser } from "@/lib/platform/support-session-server";

async function loadProfile(supabase: ReturnType<typeof createClient>, userId: string): Promise<Profile | null> {
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();

  if (profile) return profile as Profile;

  const admin = createAdminClient();
  const { data: adminProfile } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();
  return (adminProfile as Profile | null) ?? null;
}

async function loadRestaurantBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<Restaurant | null> {
  const { data: scopedRestaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (scopedRestaurant) return scopedRestaurant as Restaurant;

  const admin = createAdminClient();
  const { data: adminRestaurant } = await admin.from("restaurants").select("*").eq("slug", slug).maybeSingle();
  return (adminRestaurant as Restaurant | null) ?? null;
}

async function syncOwnerActiveRestaurant(userId: string, restaurantId: string) {
  const admin = createAdminClient();
  await admin.from("profiles").update({ restaurant_id: restaurantId }).eq("id", userId).eq("role", "owner");
}

/**
 * Server-only helper for /admin/[slug]/* and /staff/[slug]/* pages.
 * Verifies the logged-in user belongs to the restaurant identified by
 * `slug`, and (optionally) that their role is in `allowedRoles`.
 *
 * Platform Super Admin may open any slug when a support session cookie is present
 * (or when they own the restaurant). Never writes restaurant_id onto a platform-only profile.
 */
export async function getRestaurantContext(
  slug: string,
  allowedRoles?: Profile["role"][]
): Promise<{ restaurant: Restaurant; profile: Profile; platformSupport: boolean }> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const resolvedProfile = await loadProfile(supabase, user.id);
  if (!resolvedProfile) redirect("/login");
  if (resolvedProfile.is_active === false) redirect("/login?error=deactivated");

  const isPlatformAdmin = resolvedProfile.is_platform_admin === true;
  const support = isPlatformAdmin ? await readSupportSessionForUser(user.id) : null;
  const platformSupport = Boolean(support && support.slug === slug);

  const userCtx = await getUserRestaurantContext(supabase, user.id);

  const restaurant = await loadRestaurantBySlug(supabase, slug);
  if (!restaurant) notFound();

  const isPrimaryRestaurant = resolvedProfile.restaurant_id === restaurant.id;
  const isOwnerOfRestaurant = resolvedProfile.role === "owner" && restaurant.owner_id === user.id;

  if (!isPrimaryRestaurant && !isOwnerOfRestaurant && !platformSupport) {
    if (isPlatformAdmin) {
      // Platform admin must use /platform/open/[slug] (sets support cookie).
      redirect("/platform/restaurants");
    }
    if (!userCtx) redirect("/login?error=no-profile");
    redirect(`/admin/${userCtx.slug}/dashboard`);
  }

  // Never bind a dedicated platform account to a tenant via restaurant_id sync.
  if (isOwnerOfRestaurant && !isPrimaryRestaurant && resolvedProfile.restaurant_id) {
    await syncOwnerActiveRestaurant(user.id, restaurant.id);
    resolvedProfile.restaurant_id = restaurant.id;
  }

  if (
    allowedRoles &&
    !allowedRoles.includes(resolvedProfile.role) &&
    !platformSupport
  ) {
    if (!userCtx) redirect("/login?error=no-profile");
    redirect(`/admin/${userCtx.slug}/dashboard`);
  }

  return { restaurant, profile: resolvedProfile, platformSupport };
}

export async function canUserAccessAdminSlug(
  supabase: SupabaseClient,
  userId: string,
  urlSlug: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.is_platform_admin === true) {
    const support = await readSupportSessionForUser(userId);
    if (support?.slug === urlSlug) return true;
  }

  const userCtx = await getUserRestaurantContext(supabase, userId);
  if (!userCtx) return false;
  if (urlSlug === userCtx.slug) return true;
  return ownerCanAccessSlug(supabase, userId, urlSlug);
}
