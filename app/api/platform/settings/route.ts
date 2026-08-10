import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { decrypt, encrypt } from "@/lib/encryption";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * GET /api/platform/settings
 * Returns decrypted Hilaac USSD merchant codes (platform admin only).
 */
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("platform_settings")
    .select("id, evc_ussd_code_encrypted, edahab_ussd_code_encrypted, updated_at")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    evc_ussd_code: decrypt(data?.evc_ussd_code_encrypted) ?? "",
    edahab_ussd_code: decrypt(data?.edahab_ussd_code_encrypted) ?? "",
    updated_at: data?.updated_at ?? null,
  });
}

/**
 * PATCH /api/platform/settings
 * Encrypts and stores Hilaac USSD codes (never restaurant customer codes).
 */
export async function PATCH(req: NextRequest) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) return auth.response;

  let body: { evc_ussd_code?: unknown; edahab_ussd_code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: auth.user.id,
  };

  if ("evc_ussd_code" in body) {
    const v = typeof body.evc_ussd_code === "string" ? body.evc_ussd_code.trim() : "";
    update.evc_ussd_code_encrypted = v ? encrypt(v) : null;
  }
  if ("edahab_ussd_code" in body) {
    const v = typeof body.edahab_ussd_code === "string" ? body.edahab_ussd_code.trim() : "";
    update.edahab_ussd_code_encrypted = v ? encrypt(v) : null;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("platform_settings").upsert({ id: 1, ...update });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.info("[platform] settings_updated", { userId: auth.user.id });
  return NextResponse.json({ success: true });
}
