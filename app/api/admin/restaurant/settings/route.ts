import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";

/**
 * PATCH /api/admin/restaurant/settings
 * Updates general restaurant settings. Any merchant-id / API-key fields are
 * encrypted server-side with AES-256-GCM before ever touching the database —
 * plaintext secrets are never persisted or logged.
 */
export async function PATCH(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("restaurant_id, role").eq("id", user.id).maybeSingle();
  if (!profile?.restaurant_id || !["owner", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const update: Record<string, unknown> = {};

  const plainFields = [
    "name",
    "address",
    "phone",
    "logo_url",
    "dine_in_enabled",
    "takeaway_enabled",
    "payment_mode",
    "evc_ussd_code",
    "edahab_ussd_code",
    "billing_model_dinein",
    "billing_model_takeaway",
  ] as const;

  for (const field of plainFields) {
    if (field in body) update[field] = body[field];
  }

  // Secrets: encrypt in memory, never log, never echo back to the client.
  if ("evc_merchant_id" in body) {
    update.evc_merchant_id_encrypted = body.evc_merchant_id ? encrypt(String(body.evc_merchant_id)) : null;
  }
  if ("evc_api_key" in body) {
    update.evc_api_key_encrypted = body.evc_api_key ? encrypt(String(body.evc_api_key)) : null;
  }
  if ("edahab_merchant_id" in body) {
    update.edahab_merchant_id_encrypted = body.edahab_merchant_id ? encrypt(String(body.edahab_merchant_id)) : null;
  }
  if ("edahab_api_key" in body) {
    update.edahab_api_key_encrypted = body.edahab_api_key ? encrypt(String(body.edahab_api_key)) : null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { error } = await supabase.from("restaurants").update(update).eq("id", profile.restaurant_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
