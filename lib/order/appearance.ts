import type { MenuItem } from "@/types/database";

export const ORDER_THEME_STORAGE_KEY = "hilaac-order-theme";

export type OrderTheme = "light" | "dark";

/** At least this many photos required for the floating hero; else icon fallback. */
export const HERO_IMAGE_MIN = 3;
export const HERO_IMAGE_MAX = 4;

export function getTimeOfDayGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * Prefer Top Picks with images, then other available items with images.
 * Returns [] when fewer than HERO_IMAGE_MIN photos exist (caller uses fallback UI).
 */
export function pickHeroMenuImages(items: MenuItem[]): MenuItem[] {
  const withImages = items.filter(
    (m) => Boolean(m.image_url?.trim()) && m.is_available !== false
  );
  if (withImages.length < HERO_IMAGE_MIN) return [];

  const top = withImages.filter((m) => m.is_top_pick);
  const rest = withImages.filter((m) => !m.is_top_pick);
  return [...top, ...rest].slice(0, HERO_IMAGE_MAX);
}

export function readStoredOrderTheme(): OrderTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ORDER_THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    // private mode / blocked storage
  }
  return null;
}

export function writeStoredOrderTheme(theme: OrderTheme) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORDER_THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
