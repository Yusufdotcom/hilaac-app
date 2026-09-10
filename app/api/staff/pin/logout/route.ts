import { NextResponse } from "next/server";
import { clearStaffPinCookie } from "@/lib/auth/staff-pin-session";

/** POST /api/staff/pin/logout — clear PIN marker and sign out tablet session. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearStaffPinCookie(res);

  // Also clear Supabase auth cookies minted by PIN login.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (supabaseUrl) {
    try {
      const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
      const names = [
        `sb-${projectRef}-auth-token`,
        `sb-${projectRef}-auth-token.0`,
        `sb-${projectRef}-auth-token.1`,
        `sb-${projectRef}-auth-token.2`,
      ];
      for (const name of names) {
        res.cookies.set(name, "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
      }
    } catch {
      // ignore URL parse
    }
  }

  return res;
}
