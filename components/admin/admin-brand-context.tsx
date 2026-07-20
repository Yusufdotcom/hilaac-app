"use client";

import { createContext, useContext } from "react";
import { DEFAULT_BRAND_COLOR, resolveBrandColor } from "@/lib/brand/restaurant-brand";

const AdminBrandContext = createContext<string>(DEFAULT_BRAND_COLOR);

export function AdminBrandProvider({
  brandColor,
  children,
}: {
  brandColor?: string | null;
  children: React.ReactNode;
}) {
  const accent = resolveBrandColor(brandColor);

  return (
    <AdminBrandContext.Provider value={accent}>
      <div
        className="contents"
        style={{ ["--admin-brand" as string]: accent }}
      >
        {children}
      </div>
    </AdminBrandContext.Provider>
  );
}

export function useAdminBrandColor() {
  return useContext(AdminBrandContext);
}
