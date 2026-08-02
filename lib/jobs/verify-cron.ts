import { NextRequest } from "next/server";

/**
 * Verifies that a request to a /api/jobs/* route actually came from Vercel
 * Cron (or another trusted scheduler) by checking a bearer secret. Set
 * CRON_SECRET in your environment and Vercel will automatically send it as
 * `Authorization: Bearer <CRON_SECRET>` for scheduled invocations.
 *
 * Fail-closed: if CRON_SECRET is unset/empty, every request is rejected.
 */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return false;
  }
  return true;
}
