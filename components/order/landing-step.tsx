"use client";

import Image from "next/image";
import { UtensilsCrossed, ShoppingBag, ChefHat } from "lucide-react";
import { useOrderBrand } from "@/components/order/order-brand-context";
import {
  customerAccentTextStyle,
  customerPrimaryButtonStyle,
} from "@/lib/brand/restaurant-brand";
import { cn } from "@/lib/utils";

export function LandingStep({
  restaurant,
  onSelect,
  className,
}: {
  restaurant: { name: string; logo_url: string | null; dine_in_enabled: boolean; takeaway_enabled: boolean };
  onSelect: (type: "dine-in" | "takeaway") => void;
  className?: string;
}) {
  const { restaurant: brandingRestaurant, customBrandingActive } = useOrderBrand();
  const accentStyle = customerPrimaryButtonStyle(brandingRestaurant);
  const accentBorder = { borderColor: customBrandingActive ? accentStyle.backgroundColor : undefined };

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-6 text-center",
        className
      )}
    >
      <div
        className={cn(
          "mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full",
          !customBrandingActive && "bg-primary/10"
        )}
        style={customBrandingActive ? { backgroundColor: `${accentStyle.backgroundColor}22` } : undefined}
      >
        {restaurant.logo_url ? (
          <Image
            src={restaurant.logo_url}
            alt={restaurant.name}
            width={80}
            height={80}
            className="h-full w-full object-cover"
          />
        ) : (
          <ChefHat
            className={cn("h-9 w-9", !customBrandingActive && "text-primary")}
            style={customBrandingActive ? customerAccentTextStyle(brandingRestaurant) : undefined}
          />
        )}
      </div>
      <h1 className="text-2xl font-bold">Kusoo dhawaaw {restaurant.name}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Fadlan dooro nooca dalabkaaga</p>

      <div className="mt-6 grid w-full max-w-sm gap-3">
        {restaurant.dine_in_enabled && (
          <button
            type="button"
            onClick={() => onSelect("dine-in")}
            className={cn(
              "flex items-center gap-4 rounded-2xl border-2 p-5 text-left transition-transform active:scale-[0.98]",
              !customBrandingActive && "border-primary bg-primary/5"
            )}
            style={customBrandingActive ? { ...accentBorder, backgroundColor: `${accentStyle.backgroundColor}12` } : undefined}
          >
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
                !customBrandingActive && "bg-primary text-primary-foreground"
              )}
              style={customBrandingActive ? accentStyle : undefined}
            >
              <UtensilsCrossed className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold">🍽️ Fadhi</p>
              <p className="text-sm text-muted-foreground">Dine-in at your table</p>
            </div>
          </button>
        )}

        {restaurant.takeaway_enabled && (
          <button
            type="button"
            onClick={() => onSelect("takeaway")}
            className="flex items-center gap-4 rounded-2xl border-2 border-secondary bg-secondary/5 p-5 text-left transition-transform active:scale-[0.98]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-bold">📦 Qaadasho</p>
              <p className="text-sm text-muted-foreground">Takeaway / pickup</p>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
