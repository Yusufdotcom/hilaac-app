const DEFAULT_APP_URL = "https://hilaac.so";

/** Builds an absolute app URL, normalizing slashes on the base origin. */
export function buildAppUrl(path: string, baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, baseUrl).toString();
}
