import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /auth/signout — clears the Supabase session cookies server-side,
 * then redirects to /login.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  await supabase.auth.signOut();

  const url = new URL("/login", request.url);
  return NextResponse.redirect(url, { status: 302 });
}
