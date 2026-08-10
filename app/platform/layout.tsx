import { redirect } from "next/navigation";
import { getPlatformAdminSession } from "@/lib/auth/require-platform-admin";
import { PlatformShell } from "@/components/platform/platform-shell";
import { createClient } from "@/lib/supabase/server";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await getPlatformAdminSession();
  if (!session) {
    redirect("/login?error=forbidden");
  }

  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session.user.id)
    .maybeSingle();

  return (
    <PlatformShell adminName={profile?.full_name ?? session.user.email}>
      {children}
    </PlatformShell>
  );
}
