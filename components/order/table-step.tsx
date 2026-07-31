"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Armchair } from "lucide-react";
import { OrderPrimaryButton } from "@/components/order/order-primary-button";
import { OrderThemeToggle } from "@/components/order/order-theme-toggle";
import { useOrderBrandOptional } from "@/components/order/order-brand-context";
import {
  brandColorWithAlpha,
  resolveCustomerAccent,
} from "@/lib/brand/restaurant-brand";
import { cn } from "@/lib/utils";
import type { RestaurantTable } from "@/types/database";

type TableOption = {
  number: string;
  occupied: boolean;
};

function sortTableNumbers(a: string, b: string) {
  const numA = Number.parseInt(a, 10);
  const numB = Number.parseInt(b, 10);
  if (Number.isFinite(numA) && Number.isFinite(numB) && String(numA) === a && String(numB) === b) {
    return numA - numB;
  }
  return a.localeCompare(b, undefined, { numeric: true });
}

export function TableStep({
  tables,
  occupiedTableNumbers = [],
  onConfirm,
  onBack,
  className,
}: {
  restaurant: { name: string };
  tables: RestaurantTable[];
  /** Optional occupied markers (UI-only hint; selection still allowed). */
  occupiedTableNumbers?: string[];
  onConfirm: (tableNumber: string) => void;
  onBack: () => void;
  className?: string;
}) {
  const brand = useOrderBrandOptional();
  const accent = brand ? brand.accent : resolveCustomerAccent({});
  const [selected, setSelected] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const occupied = useMemo(
    () => new Set(occupiedTableNumbers.map(String)),
    [occupiedTableNumbers]
  );

  const options: TableOption[] = useMemo(() => {
    if (tables.length > 0) {
      return [...tables]
        .map((t) => t.table_number)
        .sort(sortTableNumbers)
        .map((number) => ({ number, occupied: occupied.has(number) }));
    }
    // Fallback when restaurant has no configured tables yet.
    return Array.from({ length: 12 }, (_, i) => ({
      number: String(i + 1),
      occupied: false,
    }));
  }, [tables, occupied]);

  function selectTable(number: string, isOccupied: boolean) {
    setSelected(number);
    setNeedsConfirm(isOccupied);
  }

  function handleContinue() {
    if (!selected) return;
    onConfirm(selected);
  }

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col bg-background px-5 py-4 text-foreground",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-3 motion-safe:duration-300",
        className
      )}
    >
      <div className="shrink-0">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 rounded-lg text-sm text-muted-foreground transition-colors active:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Dib u noqo
          </button>
          <OrderThemeToggle className="h-9 w-9" />
        </div>

        <div className="mt-5 text-center">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Dooro miiskaaga</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Taabo lambarka miiska aad ku fadhiyo
          </p>
        </div>
      </div>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-3">
        <div className="mx-auto grid max-w-sm grid-cols-3 gap-3 sm:grid-cols-4">
          {options.map((opt) => {
            const isSelected = selected === opt.number;
            return (
              <button
                key={opt.number}
                type="button"
                onClick={() => selectTable(opt.number, opt.occupied)}
                className={cn(
                  "relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl border-2 bg-background",
                  "shadow-sm transition-all duration-200 active:scale-[0.96]",
                  "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95",
                  !isSelected && "border-border/80 hover:border-border hover:shadow-md",
                  isSelected && "shadow-md"
                )}
                style={
                  isSelected
                    ? {
                        borderColor: accent,
                        backgroundColor: brandColorWithAlpha(accent, 0.1),
                        boxShadow: `0 8px 20px ${brandColorWithAlpha(accent, 0.22)}`,
                      }
                    : undefined
                }
                aria-pressed={isSelected}
                aria-label={`Table ${opt.number}${opt.occupied ? ", possibly occupied" : ""}`}
              >
                <Armchair
                  className="h-7 w-7"
                  style={{ color: isSelected ? accent : undefined }}
                  aria-hidden="true"
                />
                <span
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    !isSelected && "text-foreground"
                  )}
                  style={isSelected ? { color: accent } : undefined}
                >
                  {opt.number}
                </span>
                {opt.occupied && (
                  <span className="absolute right-2 top-2 flex items-center gap-1">
                    <span
                      className="h-2 w-2 rounded-full bg-amber-500 ring-2 ring-amber-100"
                      aria-hidden="true"
                    />
                    <span className="sr-only">Possibly occupied</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {needsConfirm && selected && (
          <div
            className="mx-auto mt-4 max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm text-amber-900 motion-safe:animate-in motion-safe:fade-in"
            role="status"
          >
            Please confirm this is your table before continuing.
            <span className="mt-0.5 block text-xs text-amber-700/90">
              Miiska {selected} ayaa u muuqda mid la isticmaalayo
            </span>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2 pt-3">
        {selected && (
          <p className="text-center text-sm text-muted-foreground">
            Selected:{" "}
            <span className="font-semibold text-foreground">Table {selected}</span>
          </p>
        )}
        <OrderPrimaryButton
          size="lg"
          className="h-12 w-full rounded-2xl text-base font-semibold shadow-md"
          disabled={!selected}
          onClick={handleContinue}
        >
          Sii wad
        </OrderPrimaryButton>
      </div>
    </div>
  );
}
