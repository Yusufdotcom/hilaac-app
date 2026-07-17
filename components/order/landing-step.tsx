"use client";

import { useState } from "react";
import Image from "next/image";
import { ChefHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SessionSelection } from "@/lib/order/cart-types";

export function LandingStep({
  restaurant,
  onContinue,
  className,
}: {
  restaurant: { name: string; logo_url: string | null; dine_in_enabled: boolean; takeaway_enabled: boolean };
  onContinue: (selection: SessionSelection) => void;
  className?: string;
}) {
  const [dineIn, setDineIn] = useState(false);
  const [takeaway, setTakeaway] = useState(false);

  const canContinue = dineIn || takeaway;

  function toggleDineIn() {
    if (!restaurant.dine_in_enabled) return;
    setDineIn((prev) => !prev);
  }

  function toggleTakeaway() {
    if (!restaurant.takeaway_enabled) return;
    setTakeaway((prev) => !prev);
  }

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col px-6", className)}>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/10">
          {restaurant.logo_url ? (
            <Image
              src={restaurant.logo_url}
              alt={restaurant.name}
              width={80}
              height={80}
              className="h-full w-full object-cover"
            />
          ) : (
            <ChefHat className="h-9 w-9 text-primary" />
          )}
        </div>
        <h1 className="text-2xl font-bold">Kusoo dhawaaw {restaurant.name}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Fadlan dooro nooca dalabkaaga</p>

        <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
          {restaurant.dine_in_enabled && (
            <button
              type="button"
              onClick={toggleDineIn}
              aria-pressed={dineIn}
              className={cn(
                "rounded-xl border-2 px-3 py-4 text-sm font-semibold transition-colors",
                dineIn
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-foreground hover:bg-muted/50"
              )}
            >
              🍽️ Fadhi
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Dine-in</span>
            </button>
          )}

          {restaurant.takeaway_enabled && (
            <button
              type="button"
              onClick={toggleTakeaway}
              aria-pressed={takeaway}
              className={cn(
                "rounded-xl border-2 px-3 py-4 text-sm font-semibold transition-colors",
                takeaway
                  ? "border-secondary bg-secondary/10 text-secondary-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted/50"
              )}
            >
              📦 Qaadasho
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Takeaway</span>
            </button>
          )}
        </div>

        {sessionAllowsHint(dineIn, takeaway) && (
          <p className="mt-3 max-w-xs text-xs text-muted-foreground">
            Waxaad dooran kartaa labadaba si aad u dalbato miiska iyo guriga hal mar.
          </p>
        )}
      </div>

      <div className="shrink-0 pb-2 pt-4">
        <Button
          size="lg"
          className="h-12 w-full max-w-sm mx-auto block"
          disabled={!canContinue}
          onClick={() => onContinue({ dineIn, takeaway })}
        >
          Sii wad
        </Button>
      </div>
    </div>
  );
}

function sessionAllowsHint(dineIn: boolean, takeaway: boolean) {
  return dineIn && takeaway;
}
