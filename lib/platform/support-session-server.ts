import { cookies } from "next/headers";
import {
  PLATFORM_SUPPORT_COOKIE,
  verifyPlatformSupportToken,
  type PlatformSupportSession,
} from "@/lib/platform/support-session";

/**
 * Server Components / Route Handlers only (uses next/headers).
 * Do not import this from middleware — Edge cannot use next/headers.
 */
export async function readSupportSessionForUser(
  userId: string
): Promise<PlatformSupportSession | null> {
  try {
    const jar = cookies();
    return await verifyPlatformSupportToken(jar.get(PLATFORM_SUPPORT_COOKIE)?.value, userId);
  } catch {
    return null;
  }
}
