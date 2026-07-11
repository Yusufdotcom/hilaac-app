import { redirect, notFound } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Profile, Restaurant } from "@/types/database";
import { getUserRestaurantContext } from "@/lib/admin/resolve-user-restaurant";

/**
 * Server-only helper for /admin/[slug]/* and /staff/[slug]/* pages.
 * Verifies the logged-in user belongs to the restaurant identified by
 * `slug`, and (optionally) that their role is in `allowedRoles`.
 */
export async function getRestaurantContext(
  slug: string,
  allowedRoles?: Profile["role"][]
): Promise<{ restaurant: Restaurant; profile: Profile }> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userCtx = await getUserRestaurantContext(supabase, user.id);
  if (!userCtx) redirect("/login?error=no-profile");

  // URL slug is not the user's restaurant — redirect to the correct dynamic route.
  if (slug !== userCtx.slug) {
    redirect(`/admin/${userCtx.slug}/dashboard`);
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  let resolvedProfile = profile as Profile | null;
  if (!resolvedProfile) {
    const admin = createAdminClient();
    const { data: adminProfile } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
    resolvedProfile = adminProfile as Profile | null;
  }

  if (!resolvedProfile) redirect("/login");

  let restaurant: Restaurant | null = null;

  const { data: scopedRestaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", userCtx.slug)
    .maybeSingle();

  restaurant = scopedRestaurant as Restaurant | null;

  if (!restaurant) {
    const admin = createAdminClient();
    const { data: adminRestaurant } = await admin
      .from("restaurants")
      .select("*")
      .eq("id", userCtx.profile.restaurant_id!)
      .maybeSingle();
    restaurant = adminRestaurant as Restaurant | null;
  }

  if (!restaurant) notFound();

  if (resolvedProfile.restaurant_id !== restaurant.id) redirect(`/admin/${userCtx.slug}/dashboard`);

  if (allowedRoles && !allowedRoles.includes(resolvedProfile.role)) {
    redirect(`/admin/${userCtx.slug}/dashboard`);
  }

  return { restaurant, profile: resolvedProfile };
}
