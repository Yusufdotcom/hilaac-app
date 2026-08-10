"use client";

import { Moon, Sun } from "lucide-react";
import { useAdminAppearance } from "@/components/admin/admin-appearance-context";
import { cn } from "@/lib/utils";

export function AdminThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useAdminAppearance();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--admin-border)] transition-colors hover:bg-black/5",
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? (
        <Sun className="h-[18px] w-[18px] text-[var(--admin-muted)]" />
      ) : (
        <Moon className="h-[18px] w-[18px] text-[var(--admin-muted)]" />
      )}
    </button>
  );
}
