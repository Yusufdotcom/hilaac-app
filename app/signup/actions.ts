"use server";

import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

async function provisionRestaurantAndProfile(
  userId: string,
  restaurantName: string,
  fullName: string
): Promise<string> {
  const admin = createAdminClient();

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("restaurant_id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile?.restaurant_id) {
    const { data: existingRestaurant } = await admin
      .from("restaurants")
      .select("slug")
      .eq("id", existingProfile.restaurant_id)
      .maybeSingle();
    if (existingRestaurant?.slug) return existingRestaurant.slug;
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
        owner_id: userId,
      })
      .select("id, slug")
      .single();

    if (restaurantError) {
      lastError = new Error(restaurantError.message);
      if (restaurantError.code === "23505") continue;
      throw lastError;
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      restaurant_id: restaurant.id,
      role: "owner",
      full_name: fullName,
    });

    if (profileError) {
      await admin.from("restaurants").delete().eq("id", restaurant.id);
      throw new Error(profileError.message);
    }

    await admin.from("tables").insert({ restaurant_id: restaurant.id, table_number: "1" });
    await admin.from("categories").insert([
      { restaurant_id: restaurant.id, name: "Cuntooyinka Ugu Weyn", display_order: 0 },
      { restaurant_id: restaurant.id, name: "Cabitaannada", display_order: 1 },
    ]);

    return restaurant.slug;
  }

  throw lastError ?? new Error("Could not create restaurant");
}

export async function signupAction(
  formData: FormData
): Promise<{ error?: string; needsConfirmation?: boolean }> {
  const restaurantName = String(formData.get("restaurantName") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!restaurantName || !fullName || !email || !password) {
    return { error: "All fields are required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: error.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { error: "Could not create account. Please try again." };
  }

  if (!data.session) {
    return { needsConfirmation: true };
  }

  try {
    const slug = await provisionRestaurantAndProfile(userId, restaurantName, fullName);
    redirect(`/admin/${slug}/dashboard`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not create restaurant.";
    return { error: message };
  }
}
