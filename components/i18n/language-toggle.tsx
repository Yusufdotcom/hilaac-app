"use client";

import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/components/i18n/locale-provider";
import { LOCALES, type AppLocale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

export function LanguageToggle({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { locale, setLocale, t } = useLocale();
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0]!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-10 items-center gap-1.5 rounded-xl border border-[var(--admin-border,#E2E8F0)] bg-[var(--admin-card,#fff)] px-2.5 text-sm font-medium text-[var(--admin-text,#0F172A)] transition hover:bg-[var(--admin-bg,#F8FAFC)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-brand)]",
            compact && "h-9 w-9 justify-center px-0",
            className
          )}
          aria-label={t("lang.label")}
        >
          <Globe className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
          {!compact ? (
            <span className="hidden max-w-[4.5rem] truncate sm:inline">{current.native}</span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="z-[110] w-44">
        <DropdownMenuLabel>{t("lang.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            className={cn("cursor-pointer", locale === l.code && "bg-accent")}
            onSelect={() => setLocale(l.code as AppLocale)}
          >
            <span className="mr-2 w-5 text-center text-sm" aria-hidden="true">
              {l.code === "so" ? "🇸🇴" : l.code === "ar" ? "🇸🇦" : "🇬🇧"}
            </span>
            {l.native}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
