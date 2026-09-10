import { cookies } from "next/headers";
import {
  STAFF_PIN_COOKIE,
  verifyStaffPinToken,
  type StaffPinSession,
} from "@/lib/auth/staff-pin-session";

export async function readStaffPinSession(): Promise<StaffPinSession | null> {
  const jar = cookies();
  return verifyStaffPinToken(jar.get(STAFF_PIN_COOKIE)?.value);
}
