"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { ArrowLeft, ShoppingBasket, Star, UtensilsCrossed, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import type { Category, MenuItem } from "@/types/database";

function ItemCard({ item, onSelect }: { item: MenuItem; onSelect: (item: MenuItem) => void }) {
  const unavailable = !item.is_available;

  return (
    <div
      className={cn(
        "relative flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm",
        unavailable ? "pointer-events-none cursor-not-allowed opacity-60" : "transition-transform active:scale-[0.97]"
      )}
    >
      {!unavailable ? (
        <button type="button" onClick={() => onSelect(item)} className="flex flex-1 flex-col text-left">
          <ItemCardContent item={item} unavailable={false} />
        </button>
      ) : (
        <ItemCardContent item={item} unavailable />
      )}
    </div>
  );
}

function ItemCardContent({ item, unavailable }: { item: MenuItem; unavailable: boolean }) {
  return (
    <>
      <div className="relative h-28 w-full bg-muted">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className={cn("object-cover", unavailable && "grayscale")}
          />
        ) : (
          <div
            className={cn(
              "flex h-full items-center justify-center text-muted-foreground",
              unavailable && "grayscale"
            )}
          >
            <UtensilsCrossed className="h-7 w-7" />
          </div>
        )}
        {item.is_top_pick && !unavailable && (
          <Badge className="absolute left-1.5 top-1.5 z-10 gap-1 px-1.5 py-0.5 text-[10px]">
            <Star className="h-2.5 w-2.5 fill-current" /> Top
          </Badge>
        )}
        {unavailable && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
            <span className="rounded-full bg-black/75 px-3 py-1 text-xs font-semibold text-white">
              Ma Jiro
            </span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-1 text-sm font-semibold">{item.name}</p>
        {item.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="font-bold text-primary">{formatCurrency(Number(item.price))}</span>
          {!unavailable && (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Plus className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </>
  );
}

export function MenuStep({
  restaurant,
  categories,
  menuItems,
  topPicks,
  orderType,
  tableNumber,
  cartCount,
  onBack,
  onSelectItem,
  onOpenCart,
}: {
  restaurant: { name: string };
  categories: Category[];
  menuItems: MenuItem[];
  topPicks: MenuItem[];
  orderType: "dine-in" | "takeaway";
  tableNumber: string;
  cartCount: number;
  onBack: () => void;
  onSelectItem: (item: MenuItem) => void;
  onOpenCart: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 shrink-0 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">{restaurant.name}</p>
            <p className="text-xs text-muted-foreground">
              {orderType === "dine-in" ? `Fadhi · Miiska ${tableNumber}` : "Qaadasho"}
            </p>
          </div>
          <div className="w-10" />
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className={cn("space-y-6 px-4 py-4", cartCount > 0 && "pb-28")}>
          {topPicks.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
                <Star className="h-5 w-5 fill-amber-400 text-amber-400" /> Top Picks
              </h2>
              <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                {topPicks.map((item) => (
                  <ItemCard key={item.id} item={item} onSelect={onSelectItem} />
                ))}
              </div>
            </section>
          )}

          {categories.map((category) => {
            const items = menuItems.filter((m) => m.category_id === category.id);
            if (items.length === 0) return null;
            return (
              <section key={category.id}>
                <h2 className="mb-3 text-lg font-bold">{category.name}</h2>
                <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                  {items.map((item) => (
                    <ItemCard key={item.id} item={item} onSelect={onSelectItem} />
                  ))}
                </div>
              </section>
            );
          })}

          {menuItems.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <UtensilsCrossed className="h-8 w-8" />
              Menu is empty right now.
            </div>
          )}
        </div>
      </div>

      {cartCount > 0 && (
        <div className="sticky bottom-0 z-30 shrink-0 border-t bg-background/95 px-4 py-3 backdrop-blur">
          <Button size="lg" onClick={onOpenCart} className="w-full gap-2 rounded-full shadow-lg">
            <ShoppingBasket className="h-5 w-5" />
            Saladda ({cartCount})
          </Button>
        </div>
      )}
    </div>
  );
}
