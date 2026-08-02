"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadPostLoginProfile, resolvePostAuthRedirect } from "@/lib/auth/post-login";

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

  const profile = await loadPostLoginProfile(supabase, userId);
  if (!profile) {
    redirect("/login?error=no-restaurant");
  }

  if (profile.is_active === false) {
    await supabase.auth.signOut();
    return { error: "This account has been deactivated. Contact your restaurant owner." };
  }

  const destination = await resolvePostAuthRedirect(supabase, userId);
  redirect(destination);
}
