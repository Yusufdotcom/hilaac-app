"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  readStoredAdminTheme,
  systemPrefersDark,
  writeStoredAdminTheme,
  type AdminTheme,
} from "@/lib/admin/appearance";

type AdminAppearanceContextValue = {
  theme: AdminTheme;
  toggleTheme: () => void;
  setTheme: (theme: AdminTheme) => void;
};

const AdminAppearanceContext = createContext<AdminAppearanceContextValue | null>(null);

export function AdminAppearanceProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<AdminTheme>("light");

  useEffect(() => {
    const stored = readStoredAdminTheme();
    setThemeState(stored ?? (systemPrefersDark() ? "dark" : "light"));
  }, []);

  function setTheme(next: AdminTheme) {
    setThemeState(next);
    writeStoredAdminTheme(next);
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return (
    <AdminAppearanceContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </AdminAppearanceContext.Provider>
  );
}

export function useAdminAppearance() {
  const ctx = useContext(AdminAppearanceContext);
  if (!ctx) {
    throw new Error("useAdminAppearance must be used within AdminAppearanceProvider");
  }
  return ctx;
}
