import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ownerCanAccessSlug } from "@/lib/admin/owner-branches";
import type { Profile, Restaurant } from "@/types/database";

export type ReportsAccessContext = {
  supabase: ReturnType<typeof createClient>;
  restaurant: Restaurant;
  profile: Profile;
};

/**
 * Verifies the authenticated user can access the restaurant for `slug`
 * and has owner/manager role.
 */
export async function getVerifiedReportsContext(
  slug: string
): Promise<ReportsAccessContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile || !["owner", "manager"].includes(profile.role)) return null;

  let restaurant: Restaurant | null = null;

  const { data: scopedRestaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  restaurant = (scopedRestaurant as Restaurant | null) ?? null;

  if (!restaurant) {
    const admin = createAdminClient();
    const { data: adminRestaurant } = await admin.from("restaurants").select("*").eq("slug", slug).maybeSingle();
    restaurant = (adminRestaurant as Restaurant | null) ?? null;
  }

  if (!restaurant) return null;

  const isPrimaryRestaurant = profile.restaurant_id === restaurant.id;
  const isOwnerOfRestaurant = profile.role === "owner" && restaurant.owner_id === user.id;
  const ownerHasBranchAccess =
    profile.role === "owner" && (await ownerCanAccessSlug(supabase, user.id, slug));

  if (!isPrimaryRestaurant && !isOwnerOfRestaurant && !ownerHasBranchAccess) return null;
  if (restaurant.slug !== slug) return null;

  return {
    supabase,
    restaurant,
    profile: profile as Profile,
  };
}
