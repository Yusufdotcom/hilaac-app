import { NextRequest } from "next/server";

/**
 * Verifies that a request to a /api/jobs/* route actually came from Vercel
 * Cron (or another trusted scheduler) by checking a bearer secret. Set
 * CRON_SECRET in your environment and Vercel will automatically send it as
 * `Authorization: Bearer <CRON_SECRET>` for scheduled invocations.
 */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // allow in local/dev when unset
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}
