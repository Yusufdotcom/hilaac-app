import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePostAuthRedirect } from "@/lib/auth/post-login";

/**
 * PKCE OAuth / email-link callback.
 * Exchanges ?code= for a session, then routes to MFA / dashboard / complete-signup / next=.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const errorDescription = searchParams.get("error_description") ?? searchParams.get("error");

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_oauth_code`);
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error?.message ?? "oauth_exchange_failed")}`
    );
  }

  // Password recovery links land here with next=/reset-password
  if (next?.startsWith("/") && !next.startsWith("//")) {
    if (next.startsWith("/reset-password")) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  const destination = await resolvePostAuthRedirect(supabase, data.user.id);
  const safeNext =
    next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/reset-password")
      ? next
      : null;

  // Prefer MFA-aware destination over a raw next= to admin (avoids skipping enroll).
  if (destination.startsWith("/auth/mfa") || destination.startsWith("/auth/complete-signup")) {
    return NextResponse.redirect(`${origin}${destination}`);
  }

  return NextResponse.redirect(`${origin}${safeNext ?? destination}`);
}
