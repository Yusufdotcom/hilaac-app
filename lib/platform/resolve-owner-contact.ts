import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOwnerPhone } from "@/lib/platform/resolve-owner-phone";

const EMAIL_COLUMNS = ["email", "contact_email", "owner_email"] as const;

export type OwnerContact = {
  email: string | null;
  emailSource: string | null;
  phone: string | null;
  phoneSource: string | null;
  ownerName: string | null;
};

async function firstEmailColumn(
  admin: SupabaseClient,
  table: "profiles" | "restaurants",
  match: Record<string, string>,
  sourcePrefix: string
): Promise<{ email: string; source: string } | null> {
  for (const col of EMAIL_COLUMNS) {
    const { data, error } = await admin.from(table).select(col).match(match).maybeSingle();
    if (error || !data) continue;
    const value = String((data as Record<string, unknown>)[col] ?? "").trim();
    if (value.includes("@")) {
      return { email: value, source: `${sourcePrefix}.${col}` };
    }
  }
  return null;
}

/**
 * Resolve owner contact for subscription reminders.
 * Email: Auth login email, then profile → this restaurant → sibling restaurants
 * (same fallback shape as phone, for when a restaurant-level email exists).
 */
export async function resolveOwnerContact(
  admin: SupabaseClient,
  opts: { ownerId: string; restaurantId: string }
): Promise<OwnerContact> {
  const { data: profile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", opts.ownerId)
    .maybeSingle();

  let email: string | null = null;
  let emailSource: string | null = null;

  const { data: authData } = await admin.auth.admin.getUserById(opts.ownerId);
  const authEmail = authData.user?.email?.trim();
  if (authEmail) {
    email = authEmail;
    emailSource = "auth.users.email";
  }

  if (!email) {
    const fromProfile = await firstEmailColumn(
      admin,
      "profiles",
      { id: opts.ownerId },
      "profiles"
    );
    if (fromProfile) {
      email = fromProfile.email;
      emailSource = fromProfile.source;
    }
  }

  if (!email) {
    const fromRestaurant = await firstEmailColumn(
      admin,
      "restaurants",
      { id: opts.restaurantId },
      "restaurants"
    );
    if (fromRestaurant) {
      email = fromRestaurant.email;
      emailSource = fromRestaurant.source;
    }
  }

  if (!email) {
    const { data: siblings } = await admin
      .from("restaurants")
      .select("id")
      .eq("owner_id", opts.ownerId)
      .neq("id", opts.restaurantId);

    for (const row of siblings ?? []) {
      const fromSibling = await firstEmailColumn(
        admin,
        "restaurants",
        { id: row.id },
        "owner_other_restaurant"
      );
      if (fromSibling) {
        email = fromSibling.email;
        emailSource = fromSibling.source;
        break;
      }
    }
  }

  const phone = await resolveOwnerPhone(admin, opts);

  return {
    email,
    emailSource,
    phone: phone?.phone ?? null,
    phoneSource: phone?.source ?? null,
    ownerName: profile?.full_name?.trim() || null,
  };
}
