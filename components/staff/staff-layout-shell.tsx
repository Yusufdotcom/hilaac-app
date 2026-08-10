"use client";

import { useState } from "react";
import { StaffIdleGuardian } from "@/components/auth/staff-idle-guardian";
import { StaffSidebar } from "@/components/staff/staff-sidebar";
import { StaffTopBar } from "@/components/staff/staff-top-bar";
import { PoweredByHilaac } from "@/components/brand/powered-by-hilaac";
import { resolveBrandColor } from "@/lib/brand/restaurant-brand";
import type { UserRole } from "@/types/database";

export function StaffLayoutShell({
  children,
  slug,
  role,
  restaurantName,
  logoUrl,
  subscriptionTier,
  brandColor,
}: {
  children: React.ReactNode;
  slug: string;
  role: UserRole;
  restaurantName: string;
  logoUrl: string | null;
  subscriptionTier: string;
  brandColor?: string | null;
}) {
  const accent = resolveBrandColor(brandColor);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="flex min-h-screen w-full flex-col bg-[#F5F6FA]"
      style={{
        ["--brand-accent" as string]: accent,
        ["--admin-brand" as string]: accent,
      }}
    >
      <StaffIdleGuardian role={role} />
      <StaffSidebar
        slug={slug}
        role={role}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        subscriptionTier={subscriptionTier}
        brandColor={brandColor}
        open={menuOpen}
        onOpenChange={setMenuOpen}
      />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <StaffTopBar
          role={role}
          restaurantName={restaurantName}
          onOpenSidebar={() => setMenuOpen(true)}
        />
        <main className="relative flex-1 overflow-y-auto p-4 text-[#0F172A] sm:p-6 md:p-8">
          <div
            className="pointer-events-none absolute inset-0 -z-0 opacity-100"
            style={{
              background: `radial-gradient(700px 360px at 10% -10%, color-mix(in srgb, ${accent} 14%, transparent), transparent 70%)`,
            }}
            aria-hidden="true"
          />
          <div className="relative z-[1]">{children}</div>
        </main>
        <PoweredByHilaac className="pb-6 pt-2" />
      </div>
    </div>
  );
}
