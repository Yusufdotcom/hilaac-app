import type { CSSProperties } from "react";
import type { SubscriptionTier } from "@/types/database";

export const DEFAULT_BRAND_COLOR = "#0F172A";
export const HILAAC_GOLD = "#D4A373";
export const HILAAC_NAVY = "#0F172A";
export const SIDEBAR_TEXT_COLOR = "#FFFFFF";

export type CustomerBrandingRestaurant = {
  brand_color?: string | null;
  custom_branding_enabled?: boolean | null;
  subscription_tier?: SubscriptionTier | string | null;
};

export function isCustomerBrandingActive(restaurant: CustomerBrandingRestaurant): boolean {
  return restaurant.subscription_tier === "pro" && restaurant.custom_branding_enabled === true;
}

export function resolveCustomerAccent(restaurant: CustomerBrandingRestaurant): string {
  if (isCustomerBrandingActive(restaurant)) {
    return resolveBrandColor(restaurant.brand_color);
  }
  return HILAAC_GOLD;
}

/** Primary CTA on customer menu — gold (navy text) by default, brand + white when Pro custom branding. */
export function customerPrimaryButtonStyle(restaurant: CustomerBrandingRestaurant): CSSProperties {
  if (isCustomerBrandingActive(restaurant)) {
    return {
      backgroundColor: resolveBrandColor(restaurant.brand_color),
      color: SIDEBAR_TEXT_COLOR,
    };
  }
  return {
    backgroundColor: HILAAC_GOLD,
    color: HILAAC_NAVY,
  };
}

/** Place Order / navy actions — navy by default, brand when Pro custom branding. */
export function customerPlaceOrderButtonStyle(restaurant: CustomerBrandingRestaurant): CSSProperties {
  if (isCustomerBrandingActive(restaurant)) {
    return {
      backgroundColor: resolveBrandColor(restaurant.brand_color),
      color: SIDEBAR_TEXT_COLOR,
    };
  }
  return {
    backgroundColor: HILAAC_NAVY,
    color: SIDEBAR_TEXT_COLOR,
  };
}

/** Payment buttons — gold by default; brand + white when Pro custom branding. */
export function customerPaymentButtonStyle(restaurant: CustomerBrandingRestaurant): CSSProperties {
  if (isCustomerBrandingActive(restaurant)) {
    return {
      backgroundColor: resolveBrandColor(restaurant.brand_color),
      color: SIDEBAR_TEXT_COLOR,
    };
  }
  return {
    backgroundColor: HILAAC_GOLD,
    color: HILAAC_NAVY,
  };
}

/** Active category tab — gold tint by default, brand when Pro custom branding. */
export function customerActiveTabStyle(restaurant: CustomerBrandingRestaurant): CSSProperties {
  const accent = resolveCustomerAccent(restaurant);
  if (isCustomerBrandingActive(restaurant)) {
    return {
      backgroundColor: accent,
      color: SIDEBAR_TEXT_COLOR,
      borderColor: accent,
    };
  }
  return {
    backgroundColor: `color-mix(in srgb, ${accent} 15%, white)`,
    color: HILAAC_NAVY,
    borderColor: accent,
  };
}

export function customerAccentTextStyle(restaurant: CustomerBrandingRestaurant): CSSProperties {
  return { color: resolveCustomerAccent(restaurant) };
}

/** Landing / selection cards — neutral when unselected, accent when selected. */
export function customerSelectionCardStyle(
  restaurant: CustomerBrandingRestaurant,
  selected: boolean
): CSSProperties {
  if (!selected) {
    return { borderColor: "#E5E7EB" };
  }
  const accent = resolveCustomerAccent(restaurant);
  return {
    borderColor: accent,
    backgroundColor: brandColorWithAlpha(accent, 0.08),
  };
}

/** Icon tile inside a selection card. */
export function customerSelectionIconStyle(
  restaurant: CustomerBrandingRestaurant,
  selected: boolean
): CSSProperties {
  if (!selected) {
    return { backgroundColor: "#F3F4F6", color: "#6B7280" };
  }
  if (isCustomerBrandingActive(restaurant)) {
    const accent = resolveBrandColor(restaurant.brand_color);
    return {
      backgroundColor: brandColorWithAlpha(accent, 0.2),
      color: accent,
    };
  }
  return customerPrimaryButtonStyle(restaurant);
}

export function resolveBrandColor(brandColor: string | null | undefined): string {
  const trimmed = brandColor?.trim();
  if (!trimmed) return DEFAULT_BRAND_COLOR;
  return normalizeHex(trimmed) ?? DEFAULT_BRAND_COLOR;
}

/** Normalize #RGB and #RRGGBB to uppercase #RRGGBB. */
export function normalizeHex(value: string): string | null {
  let hex = value.trim();
  if (!hex.startsWith("#")) hex = `#${hex}`;
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) return hex.toUpperCase();
  return null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex)?.replace("#", "");
  if (!normalized) return null;
  const n = Number.parseInt(normalized, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function brandColorWithAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(15, 23, 42, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function subscriptionPlanLabel(tier: SubscriptionTier | string): string {
  switch (tier) {
    case "pro":
      return "Pro Plan";
    case "starter":
      return "Starter Plan";
    case "trial":
      return "Trial Plan";
    default:
      return `${tier.charAt(0).toUpperCase()}${tier.slice(1)} Plan`;
  }
}

/** Sidebar shell — solid brand background, white labels. */
export function sidebarBrandStyles(brandColor: string | null | undefined): CSSProperties {
  const accent = resolveBrandColor(brandColor);
  return {
    backgroundColor: accent,
    color: SIDEBAR_TEXT_COLOR,
  };
}

/** Primary admin button — solid brand background, white label. */
export function brandPrimaryButtonStyle(brandColor: string | null | undefined): CSSProperties {
  return {
    backgroundColor: resolveBrandColor(brandColor),
    color: SIDEBAR_TEXT_COLOR,
  };
}

/** Active nav item — ~20% brand tint on white for background, brand-colored label. */
export function activeNavItemStyle(brandColor: string | null | undefined): CSSProperties {
  const accent = resolveBrandColor(brandColor);
  return {
    backgroundColor: `color-mix(in srgb, ${accent} 20%, white)`,
    color: accent,
  };
}
