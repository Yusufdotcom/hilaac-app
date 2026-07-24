import { createAdminClient } from "@/lib/supabase/server";
import {
  buildRestaurantBranding,
  HILAAC_GOLD,
  resolveBrandColor,
  resolveCustomerAccent,
} from "@/lib/brand/restaurant-brand";

export type RestaurantBrandingSnapshot = {
  brand_color: string | null;
  custom_branding_enabled: boolean;
  /** Resolved color for customer UI — brand_color when custom branding is on, else gold. */
  customerAccentColor: string;
};

/**
 * Fetch public customer branding fields using the service role.
 * These are non-secret styling values; anon column grants may omit them until migrated.
 */
export async function fetchRestaurantBrandingBySlug(
  slug: string
): Promise<RestaurantBrandingSnapshot | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("restaurants")
    .select("brand_color, custom_branding_enabled")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;

  const customBrandingEnabled = data.custom_branding_enabled === true;
  const branding = buildRestaurantBranding(data.brand_color, customBrandingEnabled);

  return {
    brand_color: data.brand_color,
    custom_branding_enabled: customBrandingEnabled,
    customerAccentColor: resolveCustomerAccent(branding),
  };
}

/** Resolve the customer accent from raw DB fields (server or client). */
export function resolveCustomerAccentFromFields(
  brandColor: string | null | undefined,
  customBrandingEnabled: boolean | null | undefined
): string {
  if (customBrandingEnabled === true) {
    return resolveBrandColor(brandColor);
  }
  return HILAAC_GOLD;
}
