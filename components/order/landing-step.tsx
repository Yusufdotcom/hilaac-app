"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { UtensilsCrossed, ShoppingBag, ChefHat } from "lucide-react";
import { OrderPrimaryButton } from "@/components/order/order-primary-button";
import { useOrderBrand } from "@/components/order/order-brand-context";
import {
  brandColorWithAlpha,
  customerAccentTextStyleFromAccent,
  customerSelectionCardStyleFromAccent,
  customerSelectionIconStyleFromAccent,
} from "@/lib/brand/restaurant-brand";
import { cn } from "@/lib/utils";
import type { OrderType } from "@/types/database";

function OrderTypeCard({
  type,
  selected,
  icon: Icon,
  title,
  description,
  onSelect,
}: {
  type: OrderType;
  selected: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onSelect: (type: OrderType) => void;
}) {
  const { accent, customBrandingActive } = useOrderBrand();

  return (
    <button
      type="button"
      onClick={() => onSelect(type)}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border-2 bg-background p-5 text-left",
        "transition-all duration-200 active:scale-[0.98]"
      )}
      style={customerSelectionCardStyleFromAccent(accent, selected)}
      aria-pressed={selected}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all duration-200"
        style={customerSelectionIconStyleFromAccent(accent, selected, customBrandingActive)}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div>
        <p className="text-lg font-bold">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

export function LandingStep({
  restaurant,
  onSelect,
  className,
}: {
  restaurant: { name: string; logo_url: string | null; dine_in_enabled: boolean; takeaway_enabled: boolean };
  onSelect: (type: OrderType) => void;
  className?: string;
}) {
  const { accent } = useOrderBrand();
  const accentTextStyle = customerAccentTextStyleFromAccent(accent);

  const [selectedOrderType, setSelectedOrderType] = useState<OrderType | null>(null);

  useEffect(() => {
    if (restaurant.dine_in_enabled && !restaurant.takeaway_enabled) {
      setSelectedOrderType("dine-in");
    } else if (!restaurant.dine_in_enabled && restaurant.takeaway_enabled) {
      setSelectedOrderType("takeaway");
    }
  }, [restaurant.dine_in_enabled, restaurant.takeaway_enabled]);

  function handleContinue() {
    if (!selectedOrderType) return;
    onSelect(selectedOrderType);
  }

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-6 text-center",
        className
      )}
    >
      <div
        className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full transition-all duration-200"
        style={{ backgroundColor: brandColorWithAlpha(accent, 0.12) }}
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
          <ChefHat className="h-9 w-9 transition-colors duration-200" style={accentTextStyle} />
        )}
      </div>
      <h1 className="text-2xl font-bold">Kusoo dhawaaw {restaurant.name}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">Fadlan dooro nooca dalabkaaga</p>

      <div className="mt-6 grid w-full max-w-sm gap-3">
        {restaurant.dine_in_enabled && (
          <OrderTypeCard
            type="dine-in"
            selected={selectedOrderType === "dine-in"}
            icon={UtensilsCrossed}
            title="🍽️ Fadhi"
            description="Dine-in at your table"
            onSelect={setSelectedOrderType}
          />
        )}

        {restaurant.takeaway_enabled && (
          <OrderTypeCard
            type="takeaway"
            selected={selectedOrderType === "takeaway"}
            icon={ShoppingBag}
            title="📦 Qaadasho"
            description="Takeaway / pickup"
            onSelect={setSelectedOrderType}
          />
        )}
      </div>

      <OrderPrimaryButton
        type="button"
        size="lg"
        disabled={!selectedOrderType}
        onClick={handleContinue}
        className="mt-6 w-full max-w-sm rounded-full transition-all duration-200 disabled:opacity-50"
      >
        Sii wad
      </OrderPrimaryButton>
    </div>
  );
}
