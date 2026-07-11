"use server";

import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { error: "Could not establish a session. Please try again." };
  }

  // Link check: public.profiles.restaurant_id → public.restaurants.slug
  const { data: authProfile, error: profileError } = await supabase
    .from("profiles")
    .select("role, restaurant_id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return { error: profileError.message };
  }

  let profile = authProfile;

  if (!profile?.restaurant_id) {
    const admin = createAdminClient();
    const { data: adminProfile } = await admin
      .from("profiles")
      .select("role, restaurant_id")
      .eq("id", userId)
      .maybeSingle();
    profile = adminProfile;
  }

  if (!profile?.restaurant_id) {
    redirect("/login?error=no-restaurant");
  }

  const { data: authRestaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select("slug")
    .eq("id", profile.restaurant_id)
    .maybeSingle();

  if (restaurantError) {
    return { error: restaurantError.message };
  }

  let restaurant = authRestaurant;

  if (!restaurant?.slug) {
    const admin = createAdminClient();
    const { data: adminRestaurant } = await admin
      .from("restaurants")
      .select("slug")
      .eq("id", profile.restaurant_id)
      .maybeSingle();
    restaurant = adminRestaurant;
  }

  if (!restaurant?.slug) {
    redirect("/login?error=no-restaurant");
  }

  const staffRoles = ["waiter", "kitchen", "cashier"];
  const destination = staffRoles.includes(profile.role)
    ? `/staff/${restaurant.slug}/${profile.role === "kitchen" ? "kitchen" : profile.role}`
    : `/admin/${restaurant.slug}/dashboard`;

  redirect(destination);
}
