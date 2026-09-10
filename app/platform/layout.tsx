import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { PlatformShell } from "@/components/platform/platform-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Hilaac Platform",
  description: "Cross-tenant Super Admin console for Hilaac.",
};

export const dynamic = "force-dynamic";

/**
 * Tenant-agnostic platform console.
 * Never wraps AdminLayoutShell — no restaurant sidebar, brand_color, or slug context.
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformAdminSession();
  // Never show a 403 page — bounce restaurant owners (and guests) straight to /admin.
  if (!session) {
    redirect("/admin");
  }

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session.user.id)
    .maybeSingle();

  const adminName =
    profile?.full_name?.trim() || session.user.email?.split("@")[0] || "Platform admin";

  return (
    <PlatformShell adminName={adminName}>
      {children}
    </PlatformShell>
  );
}
