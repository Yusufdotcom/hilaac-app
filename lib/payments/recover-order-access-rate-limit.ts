/**
 * In-memory rate limit for order access recovery (phone remint).
 * Per IP + orderId, fail-closed when over limit.
 */

const hits = new Map<string, number[]>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_HITS = 8;

export function isRecoverAccessRateLimited(ip: string, orderId: string): boolean {
  const key = `${ip || "unknown"}:${orderId || "unknown"}`;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const prior = (hits.get(key) ?? []).filter((t) => t > windowStart);
  if (prior.length >= MAX_HITS) {
    hits.set(key, prior);
    return true;
  }
  prior.push(now);
  hits.set(key, prior);
  return false;
}

export function clientIpFromRequest(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
