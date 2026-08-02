"use server";

import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { resolvePostAuthRedirect } from "@/lib/auth/post-login";

export async function completeGoogleSignupAction(
  formData: FormData
): Promise<{ error?: string }> {
  const restaurantName = String(formData.get("restaurantName") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();

  if (!restaurantName || !fullName) {
    return { error: "Restaurant name and your name are required." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("restaurant_id")
    .eq("id", user.id)
    .maybeSingle();

  if (existing?.restaurant_id) {
    const dest = await resolvePostAuthRedirect(supabase, user.id);
    redirect(dest);
  }

  const baseSlug = slugify(restaurantName);
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.floor(Math.random() * 1000)}`;
    const { data: restaurant, error: restaurantError } = await admin
      .from("restaurants")
      .insert({
        name: restaurantName,
        slug,
        owner_id: user.id,
      })
      .select("id, slug")
      .single();

    if (restaurantError) {
      lastError = new Error(restaurantError.message);
      if (restaurantError.code === "23505") continue;
      return { error: restaurantError.message };
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: user.id,
      restaurant_id: restaurant.id,
      role: "owner",
      full_name: fullName,
      is_active: true,
    });

    if (profileError) {
      await admin.from("restaurants").delete().eq("id", restaurant.id);
      return { error: profileError.message };
    }

    await admin.from("tables").insert({ restaurant_id: restaurant.id, table_number: "1" });
    await admin.from("categories").insert([
      { restaurant_id: restaurant.id, name: "Cuntooyinka Ugu Weyn", display_order: 0 },
      { restaurant_id: restaurant.id, name: "Cabitaannada", display_order: 1 },
    ]);

    await supabase.auth.updateUser({ data: { full_name: fullName } });

    const dest = await resolvePostAuthRedirect(supabase, user.id);
    redirect(dest);
  }

  return { error: lastError?.message ?? "Could not create restaurant" };
}
