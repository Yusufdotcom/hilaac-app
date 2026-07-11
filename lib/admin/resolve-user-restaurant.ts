import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export type UserRestaurantContext = {
  profile: Pick<Profile, "role" | "restaurant_id">;
  slug: string;
  isDemo: boolean;
};

/** Demo restaurants (slug prefix demo-) are public ordering sandboxes, not admin tenants. */
export function isDemoSlug(slug: string): boolean {
  return slug.startsWith("demo-");
}

/**
 * Loads the user's row from public.profiles (matched by profiles.id = auth user id),
 * then resolves the restaurant slug via profiles.restaurant_id → restaurants.id.
 */
export async function getUserRestaurantContext(
  supabase: SupabaseClient,
  userId: string
): Promise<UserRestaurantContext | null> {
  let profile: Pick<Profile, "role" | "restaurant_id"> | null = null;

  const { data: authProfile, error: profileError } = await supabase
    .from("profiles")
    .select("role, restaurant_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("profiles lookup failed:", profileError.message);
  } else {
    profile = authProfile;
  }

  // Fallback only when RLS/grants block the authenticated client — not when restaurant_id is null.
  if (!profile) {
    const admin = createAdminClient();
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("role, restaurant_id")
      .eq("id", userId)
      .maybeSingle();
    profile = adminProfile;
  }

  if (!profile?.restaurant_id) return null;

  let restaurant: { slug: string; is_demo: boolean | null } | null = null;

  const { data: authRestaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("slug, is_demo")
    .eq("id", profile.restaurant_id)
    .maybeSingle();

  if (restaurantError) {
    console.error("restaurants lookup failed:", restaurantError.message);
  } else {
    restaurant = authRestaurant;
  }

  if (!restaurant?.slug) {
    const admin = createAdminClient();
    const { data: adminRestaurant } = await admin
      .from("restaurants")
      .select("slug, is_demo")
      .eq("id", profile.restaurant_id)
      .maybeSingle();
    restaurant = adminRestaurant;
  }

  if (!restaurant?.slug) return null;

  return {
    profile,
    slug: restaurant.slug,
    isDemo: restaurant.is_demo === true || isDemoSlug(restaurant.slug),
  };
}

/** Destination path after a successful login. */
export async function getPostLoginPath(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const ctx = await getUserRestaurantContext(supabase, userId);
  if (!ctx) return null;

  const staffRoles: Profile["role"][] = ["waiter", "kitchen", "cashier"];
  if (staffRoles.includes(ctx.profile.role as Profile["role"])) {
    const segment = ctx.profile.role === "kitchen" ? "kitchen" : ctx.profile.role;
    return `/staff/${ctx.slug}/${segment}`;
  }

  return `/admin/${ctx.slug}/dashboard`;
}

/**
 * When the URL slug does not match the user's restaurant (e.g. stale demo slug),
 * returns the correct admin base path, or null if no redirect is needed.
 */
export async function getAdminSlugRedirect(
  supabase: SupabaseClient,
  userId: string,
  urlSlug: string
): Promise<string | null> {
  const ctx = await getUserRestaurantContext(supabase, userId);
  if (!ctx) return null;

  if (urlSlug !== ctx.slug) {
    return `/admin/${ctx.slug}/dashboard`;
  }

  return null;
}
