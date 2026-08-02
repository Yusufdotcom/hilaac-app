import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Profile, Restaurant, UserRole } from "@/types/database";

const STAFF_LOYALTY_ROLES: UserRole[] = ["owner", "manager", "cashier"];
const ADMIN_LOYALTY_ROLES: UserRole[] = ["owner", "manager"];

export async function getLoyaltyStaffContext(
  slug: string,
  roles: UserRole[] = STAFF_LOYALTY_ROLES
): Promise<{ restaurant: Restaurant; profile: Profile; userId: string } | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.is_active === false || !roles.includes(profile.role as UserRole)) {
    return null;
  }

  const admin = createAdminClient();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!restaurant) return null;

  const isPrimary = profile.restaurant_id === restaurant.id;
  const isOwner = profile.role === "owner" && restaurant.owner_id === user.id;
  if (!isPrimary && !isOwner) return null;

  return {
    restaurant: restaurant as Restaurant,
    profile: profile as Profile,
    userId: user.id,
  };
}

export { STAFF_LOYALTY_ROLES, ADMIN_LOYALTY_ROLES };
