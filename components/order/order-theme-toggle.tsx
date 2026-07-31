"use client";

import { Moon, Sun } from "lucide-react";
import { useOrderAppearance } from "@/components/order/order-appearance-context";
import { cn } from "@/lib/utils";

export function OrderThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useOrderAppearance();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition-colors",
        "active:scale-95",
        isDark
          ? "border-white/15 bg-white/10 text-amber-100 hover:bg-white/15"
          : "border-black/10 bg-white/70 text-stone-700 hover:bg-white/90",
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun className="h-4.5 w-4.5 h-[1.1rem] w-[1.1rem]" /> : <Moon className="h-[1.1rem] w-[1.1rem]" />}
    </button>
  );
}
