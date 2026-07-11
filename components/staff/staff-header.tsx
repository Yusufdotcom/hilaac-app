"use client";

import { ChefHat, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/constants";

export function StaffHeader({ restaurantName, role }: { restaurantName: string; role: string }) {
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-2 font-bold text-primary">
        <ChefHat className="h-6 w-6" />
        {restaurantName}
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="secondary">{ROLE_LABELS[role] ?? role}</Badge>
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
