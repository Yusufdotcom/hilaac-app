"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { HilaacLogo } from "@/components/brand/hilaac-logo";
import { ROLE_LABELS } from "@/lib/constants";

export function StaffSidebar({
  restaurantName,
  role,
}: {
  restaurantName: string;
  role: string;
}) {
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-hilaac-dark bg-hilaac-navy text-white">
      <div className="flex h-16 items-center border-b border-hilaac-dark px-5">
        <HilaacLogo href="/" variant="light" src="/logo-icon.png" />
      </div>
      <div className="border-b border-hilaac-dark px-5 py-4">
        <p className="truncate text-sm font-semibold text-white">{restaurantName}</p>
        <Badge className="mt-2 border-hilaac-gold/40 bg-hilaac-gold text-hilaac-navy hover:bg-hilaac-gold/90">
          {ROLE_LABELS[role] ?? role}
        </Badge>
      </div>
      <div className="flex-1" />
      <div className="border-t border-hilaac-dark p-3">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-hilaac-muted transition-colors hover:bg-hilaac-dark hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}
