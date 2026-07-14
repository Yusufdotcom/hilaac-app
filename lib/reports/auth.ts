import { createClient } from "@/lib/supabase/server";
import { getUserRestaurantContext } from "@/lib/admin/resolve-user-restaurant";
import type { Profile, Restaurant } from "@/types/database";

export type ReportsAccessContext = {
  supabase: ReturnType<typeof createClient>;
  restaurant: Restaurant;
  profile: Profile;
};

/**
 * Verifies the authenticated user owns the restaurant for `slug`
 * and has owner/manager role. Never trusts slug alone.
 */
export async function getVerifiedReportsContext(
  slug: string
): Promise<ReportsAccessContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const userCtx = await getUserRestaurantContext(supabase, user.id);
  if (!userCtx || userCtx.slug !== slug) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return null;

  if (profile.restaurant_id !== userCtx.profile.restaurant_id) return null;
  if (!["owner", "manager"].includes(profile.role)) return null;

  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", profile.restaurant_id!)
    .maybeSingle();

  if (!restaurant || restaurant.slug !== slug) return null;
  if (restaurant.id !== profile.restaurant_id) return null;

  return {
    supabase,
    restaurant: restaurant as Restaurant,
    profile: profile as Profile,
  };
}
