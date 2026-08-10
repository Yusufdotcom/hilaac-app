export const ADMIN_THEME_STORAGE_KEY = "hilaac-admin-theme";

export type AdminTheme = "light" | "dark";

export function readStoredAdminTheme(): AdminTheme | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark") return raw;
  } catch {
    // private mode
  }
  return null;
}

export function writeStoredAdminTheme(theme: AdminTheme) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
