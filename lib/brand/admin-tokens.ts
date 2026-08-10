/**
 * Single source of truth for restaurant brand_color in Admin UI.
 * Values come from AdminBrandProvider → CSS vars --admin-brand / --brand-accent.
 */

export const ADMIN_BRAND_CSS_VAR = "--admin-brand";
export const ADMIN_BRAND_FALLBACK = "#0F172A";

/** Inline style helper when a class is awkward (charts, SVG stroke). */
export function adminBrandCssVar(fallback = ADMIN_BRAND_FALLBACK): string {
  return `var(${ADMIN_BRAND_CSS_VAR}, var(--brand-accent, ${fallback}))`;
}

/** Price / accent text — always follows restaurant brand_color. */
export const adminBrandTextClass =
  "text-[color:var(--admin-brand,var(--brand-accent,#0F172A))]";

/** Focus rings that should match brand (not Hilaac gold). */
export const adminBrandRingClass =
  "focus-visible:ring-[color:var(--admin-brand,var(--brand-accent,#0F172A))]";

/** Borders that should match brand (active plan cards, etc.). */
export const adminBrandBorderClass =
  "border-[color:var(--admin-brand,var(--brand-accent,#0F172A))]";

/** Soft icon well (dashboard stat cards). */
export const adminBrandIconWellClass =
  "bg-[color:color-mix(in_srgb,var(--admin-brand,var(--brand-accent,#0F172A))_12%,white)] text-[color:var(--admin-brand,var(--brand-accent,#0F172A))]";

/** Soft callout / banner surface tinted with brand. */
export const adminBrandCalloutClass =
  "border-[color:color-mix(in_srgb,var(--admin-brand,var(--brand-accent,#0F172A))_32%,white)] bg-[color:color-mix(in_srgb,var(--admin-brand,var(--brand-accent,#0F172A))_10%,white)] text-[color:var(--admin-brand,var(--brand-accent,#0F172A))]";

/** Solid CTA using brand (banner buttons). */
export const adminBrandSolidButtonClass =
  "bg-[color:var(--admin-brand,var(--brand-accent,#0F172A))] text-white hover:opacity-90";
