import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/require-platform-admin";
import { decrypt, encrypt } from "@/lib/encryption";
import { createAdminClient } from "@/lib/supabase/server";

function jsonError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
}

/**
 * GET /api/platform/settings
 * Returns decrypted Hilaac USSD merchant codes (platform admin only).
 */
export async function GET() {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return auth.response;

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("platform_settings")
      .select("id, evc_ussd_code_encrypted, edahab_ussd_code_encrypted, updated_at")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return jsonError(error.message, 500);
    }

    let evc = "";
    let edahab = "";
    try {
      evc = decrypt(data?.evc_ussd_code_encrypted) ?? "";
      edahab = decrypt(data?.edahab_ussd_code_encrypted) ?? "";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Decrypt failed";
      console.error("[platform] settings_decrypt_failed", msg);
      return jsonError(
        msg.includes("ENCRYPTION_SECRET_KEY")
          ? "Server encryption key is not configured"
          : "Could not decrypt stored payment codes",
        500,
        "encryption_error"
      );
    }

    return NextResponse.json({
      evc_ussd_code: evc,
      edahab_ussd_code: edahab,
      updated_at: data?.updated_at ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("[platform] settings_get_failed", msg);
    return jsonError(msg, 500);
  }
}

/**
 * PATCH /api/platform/settings
 * Encrypts and stores Hilaac USSD codes (never restaurant customer codes).
 */
export async function PATCH(req: NextRequest) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return auth.response;

    let body: { evc_ussd_code?: unknown; edahab_ussd_code?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonError("Invalid JSON", 400);
    }

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      updated_by: auth.user.id,
    };

    try {
      if ("evc_ussd_code" in body) {
        const v = typeof body.evc_ussd_code === "string" ? body.evc_ussd_code.trim() : "";
        update.evc_ussd_code_encrypted = v ? encrypt(v) : null;
      }
      if ("edahab_ussd_code" in body) {
        const v = typeof body.edahab_ussd_code === "string" ? body.edahab_ussd_code.trim() : "";
        update.edahab_ussd_code_encrypted = v ? encrypt(v) : null;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Encrypt failed";
      console.error("[platform] settings_encrypt_failed", msg);
      return jsonError(
        msg.includes("ENCRYPTION_SECRET_KEY")
          ? "Server encryption key is not configured (ENCRYPTION_SECRET_KEY)"
          : "Could not encrypt payment codes",
        500,
        "encryption_error"
      );
    }

    const admin = createAdminClient();
    const { error } = await admin.from("platform_settings").upsert({ id: 1, ...update });

    if (error) {
      return jsonError(error.message, 500);
    }

    console.info("[platform] settings_updated", { userId: auth.user.id });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("[platform] settings_patch_failed", msg);
    return jsonError(msg, 500);
  }
}
