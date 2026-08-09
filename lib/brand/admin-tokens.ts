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
