import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/restaurant/test-connection
 * Validates a merchant ID / API key pair against the EVC or eDahab sandbox
 * before the restaurant saves it. Credentials are used in memory only and
 * are never written to the database or logs by this route.
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider, merchantId, apiKey } = await req.json();

  if (!provider || !merchantId || !apiKey) {
    return NextResponse.json({ error: "Merchant ID and API key are required" }, { status: 400 });
  }

  const baseUrl = provider === "evc" ? process.env.EVC_API_BASE_URL : process.env.EDAHAB_API_BASE_URL;

  if (!baseUrl) {
    return NextResponse.json(
      { error: `${provider.toUpperCase()}_API_BASE_URL is not configured on the server yet.` },
      { status: 503 }
    );
  }

  try {
    const res = await fetch(`${baseUrl}/merchant/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ merchantId }),
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ success: false, error: "The gateway rejected these credentials." }, { status: 200 });
    }

    return NextResponse.json({ success: true, message: "Connection verified successfully." });
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not reach the payment gateway. Check your network and try again." },
      { status: 200 }
    );
  }
}
