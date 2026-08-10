import { NextRequest, NextResponse } from "next/server";
import { requireActiveStaff } from "@/lib/auth/require-active-staff";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/**
 * POST multipart form field `file` — uploads to profile-avatars/{userId}/…
 * and sets profiles.avatar_url.
 */
export async function POST(req: NextRequest) {
  const gate = await requireActiveStaff({
    roles: ["owner", "manager", "cashier", "waiter", "kitchen"],
    requireRestaurant: false,
  });
  if (!gate.ok) return gate.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 2MB" }, { status: 400 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${gate.user.id}/avatar-${Date.now()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await gate.supabase.storage
    .from("profile-avatars")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = gate.supabase.storage.from("profile-avatars").getPublicUrl(path);

  const { error: updateError } = await gate.supabase
    .from("profiles")
    .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", gate.user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ avatarUrl: publicUrl });
}
