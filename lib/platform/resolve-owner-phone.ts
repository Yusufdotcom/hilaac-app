import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Resolve a reachable owner phone for subscription reminders.
 * Branch restaurants often have null phone; the owner's primary location may not.
 */
export async function resolveOwnerPhone(
  admin: SupabaseClient,
  opts: { ownerId: string; restaurantId: string }
): Promise<{ phone: string; source: string } | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("phone")
    .eq("id", opts.ownerId)
    .maybeSingle();

  const profilePhone = profile?.phone?.trim();
  if (profilePhone) {
    return { phone: profilePhone, source: "profiles.phone" };
  }

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("phone, takeaway_hotline")
    .eq("id", opts.restaurantId)
    .maybeSingle();

  const restPhone = restaurant?.phone?.trim() || restaurant?.takeaway_hotline?.trim();
  if (restPhone) {
    return { phone: restPhone, source: "restaurants.phone" };
  }

  const { data: siblings } = await admin
    .from("restaurants")
    .select("id, phone, takeaway_hotline")
    .eq("owner_id", opts.ownerId)
    .neq("id", opts.restaurantId);

  for (const row of siblings ?? []) {
    const p = row.phone?.trim() || row.takeaway_hotline?.trim();
    if (p) {
      return { phone: p, source: "owner_other_restaurant.phone" };
    }
  }

  return null;
}
