import type { CSSProperties } from "react";
import type { SubscriptionTier } from "@/types/database";

export const DEFAULT_BRAND_COLOR = "#0F172A";
export const SIDEBAR_TEXT_COLOR = "#FFFFFF";

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

/** Active nav item — ~20% brand tint on white for background, brand-colored label. */
export function activeNavItemStyle(brandColor: string | null | undefined): CSSProperties {
  const accent = resolveBrandColor(brandColor);
  return {
    backgroundColor: `color-mix(in srgb, ${accent} 20%, white)`,
    color: accent,
  };
}
