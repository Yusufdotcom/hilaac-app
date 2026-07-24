"use client";

import { StaffSidebar } from "@/components/staff/staff-sidebar";
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

  return (
    <div
      className="flex min-h-screen w-full flex-col bg-[#F8FAFC]"
      style={{ ["--brand-accent" as string]: accent }}
    >
      <StaffSidebar
        slug={slug}
        role={role}
        restaurantName={restaurantName}
        logoUrl={logoUrl}
        subscriptionTier={subscriptionTier}
        brandColor={brandColor}
      />

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <main className="app-light-surface flex-1 overflow-y-auto p-4 pt-16 text-[#0F172A] sm:p-6 md:p-8">
          {children}
        </main>
        <PoweredByHilaac className="pb-6 pt-2" />
      </div>
    </div>
  );
}
