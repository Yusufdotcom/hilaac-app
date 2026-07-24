import { NextRequest, NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/encryption";
import { generateSlug } from "@/lib/utils";

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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("restaurant_id, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.restaurant_id || !["owner", "manager"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
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
  if (!isOwner && !isPrimary) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
    "brand_color",
    "custom_branding_enabled",
  ] as const;

  for (const field of plainFields) {
    if (field in body) update[field] = body[field];
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
