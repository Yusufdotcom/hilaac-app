"use client";

import Image from "next/image";
import { UtensilsCrossed, ShoppingBag, ChefHat } from "lucide-react";

export function LandingStep({
  restaurant,
  onSelect,
}: {
  restaurant: { name: string; logo_url: string | null; dine_in_enabled: boolean; takeaway_enabled: boolean };
  onSelect: (type: "dine-in" | "takeaway") => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-primary/10">
        {restaurant.logo_url ? (
          <Image src={restaurant.logo_url} alt={restaurant.name} width={96} height={96} className="h-full w-full object-cover" />
        ) : (
          <ChefHat className="h-10 w-10 text-primary" />
        )}
      </div>
      <h1 className="text-2xl font-bold">Kusoo dhawaaw {restaurant.name}</h1>
      <p className="mt-2 text-muted-foreground">Fadlan dooro nooca dalabkaaga</p>

      <div className="mt-10 grid w-full max-w-sm gap-4">
        {restaurant.dine_in_enabled && (
          <button
            onClick={() => onSelect("dine-in")}
            className="flex items-center gap-4 rounded-2xl border-2 border-primary bg-primary/5 p-6 text-left transition-transform active:scale-[0.98]"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <UtensilsCrossed className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-bold">Fadhi</p>
              <p className="text-sm text-muted-foreground">Dine-in at your table</p>
            </div>
          </button>
        )}

        {restaurant.takeaway_enabled && (
          <button
            onClick={() => onSelect("takeaway")}
            className="flex items-center gap-4 rounded-2xl border-2 border-secondary bg-secondary/5 p-6 text-left transition-transform active:scale-[0.98]"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <div>
              <p className="text-lg font-bold">Qaadasho</p>
              <p className="text-sm text-muted-foreground">Takeaway / pickup</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
