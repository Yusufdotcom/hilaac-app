import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";
import { generateSlug } from "@/lib/utils";
import { bodyTouchesPaymentSettings, requireAal2ForPrivilegedRole } from "@/lib/auth/aal";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";

/**
 * PATCH /api/admin/restaurant/settings
 * Updates general restaurant settings. Any merchant-id / API-key fields are
 * encrypted server-side with AES-256-GCM before ever touching the database —
 * plaintext secrets are never persisted or logged.
 *
 * When `name` changes, regenerates `slug` and stores the previous slug so
 * printed QR codes at `/order/[old-slug]` keep working via redirect.
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireActiveStaff({ roles: ["owner", "manager"] });
  if (!auth.ok) return auth.response;

  const { supabase, user, profile } = auth;

  // N6: all settings mutations require AAL2 for owner/manager (payment fields included).
  const aal = await requireAal2ForPrivilegedRole(supabase, profile.role);
  if (!aal.ok) return aal.response;

  const body = await req.json();

  // C2: platform support Open must never write (or re-key) merchant credentials.
  if (profile.platform_support && bodyTouchesPaymentSettings(body)) {
    return NextResponse.json(
      {
        error: "Platform support view cannot change merchant payment credentials",
        code: "platform_support_payment_blocked",
      },
      { status: 403 }
    );
  }

  const restaurantId =
    typeof body.restaurant_id === "string" && body.restaurant_id
      ? body.restaurant_id
      : profile.restaurant_id;

  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("restaurants")
    .select("id, name, slug, owner_id")
    .eq("id", restaurantId)
    .maybeSingle();

  if (currentError || !current) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const isOwner = profile.role === "owner" && current.owner_id === user.id;
  const isPrimary = profile.restaurant_id === current.id;
  const isPlatformSupport =
    profile.platform_support === true && profile.restaurant_id === current.id;
  if (!isOwner && !isPrimary && !isPlatformSupport) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const update: Record<string, unknown> = {};

  const plainFields = [
    "name",
    "address",
    "phone",
    "takeaway_hotline",
    "logo_url",
    "dine_in_enabled",
    "takeaway_enabled",
    "payment_mode",
    "evc_ussd_code",
    "edahab_ussd_code",
    "billing_model_dinein",
    "billing_model_takeaway",
    "brand_color",
    "custom_branding_enabled",
    "opening_time",
    "closing_time",
    "business_days",
    "currency",
    "currency_rate",
  ] as const;

  for (const field of plainFields) {
    if (field in body) update[field] = body[field];
  }

  if ("currency" in body) {
    const c = String(body.currency || "USD").toUpperCase();
    update.currency = c === "SOS" ? "SOS" : "USD";
  }
  if ("currency_rate" in body) {
    const rate = Number(body.currency_rate);
    update.currency_rate =
      Number.isFinite(rate) && rate > 0 ? rate : update.currency === "SOS" ? 571 : 1;
  }

  if ("opening_time" in body) {
    const v = body.opening_time;
    update.opening_time = typeof v === "string" && /^\d{1,2}:\d{2}/.test(v.trim()) ? v.trim() : null;
  }
  if ("closing_time" in body) {
    const v = body.closing_time;
    update.closing_time = typeof v === "string" && /^\d{1,2}:\d{2}/.test(v.trim()) ? v.trim() : null;
  }
  if ("business_days" in body) {
    const raw = Array.isArray(body.business_days) ? body.business_days : [];
    const days: number[] = [];
    for (const item of raw) {
      const n = Number(item);
      if (Number.isInteger(n) && n >= 0 && n <= 6 && !days.includes(n)) days.push(n);
    }
    days.sort((a, b) => a - b);
    update.business_days = days.length === 0 || days.length === 7 ? null : days;
  }

  if ("evc_merchant_id" in body) {
    update.evc_merchant_id_encrypted = body.evc_merchant_id
      ? encrypt(String(body.evc_merchant_id))
      : null;
  }
  if ("evc_api_key" in body) {
    update.evc_api_key_encrypted = body.evc_api_key ? encrypt(String(body.evc_api_key)) : null;
  }
  if ("edahab_merchant_id" in body) {
    update.edahab_merchant_id_encrypted = body.edahab_merchant_id
      ? encrypt(String(body.edahab_merchant_id))
      : null;
  }
  if ("edahab_api_key" in body) {
    update.edahab_api_key_encrypted = body.edahab_api_key
      ? encrypt(String(body.edahab_api_key))
      : null;
  }

  let newSlug: string | null = null;

  if (typeof body.name === "string" && body.name.trim() && body.name.trim() !== current.name) {
    const base = generateSlug(body.name) || current.slug;
    newSlug = await ensureUniqueSlug(admin, base, current.id);
    if (newSlug !== current.slug) {
      update.slug = newSlug;
      update.previous_slug = current.slug;
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: updated, error } = await admin
    .from("restaurants")
    .update(update)
    .eq("id", current.id)
    .select("id, name, slug, previous_slug")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    restaurant: updated,
    slugChanged: Boolean(newSlug && newSlug !== current.slug),
    previousSlug: newSlug && newSlug !== current.slug ? current.slug : null,
    newSlug: updated.slug,
  });
}

async function ensureUniqueSlug(
  admin: ReturnType<typeof createAdminClient>,
  base: string,
  excludeId: string
): Promise<string> {
  let candidate = base;
  let attempt = 2;

  while (attempt < 50) {
    const { data } = await admin
      .from("restaurants")
      .select("id")
      .eq("slug", candidate)
      .neq("id", excludeId)
      .maybeSingle();

    if (!data) return candidate;
    candidate = `${base}-${attempt}`;
    attempt += 1;
  }

  return `${base}-${Date.now().toString(36)}`;
}
