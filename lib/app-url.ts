/**
 * Canonical public app origin helpers.
 * Always prefer NEXT_PUBLIC_APP_URL (production: https://hilaacapp.so).
 * Never fall back to VERCEL_URL — that silently breaks custom-domain auth redirects.
 */

/** Canonical public app origin (no trailing slash). */
export function getAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_APP_URL is required in production (expected https://hilaacapp.so)"
    );
  }

  return "http://localhost:3000";
}

/** Builds an absolute app URL, normalizing slashes on the base origin. */
export function buildAppUrl(path: string, baseUrl?: string): string {
  const base = (baseUrl ?? getAppUrl()).replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${base}/`).toString();
}
