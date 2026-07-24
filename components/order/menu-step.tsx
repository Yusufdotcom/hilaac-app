"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ShoppingBasket, Star, UtensilsCrossed, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OrderPrimaryButton } from "@/components/order/order-primary-button";
import { useOrderBrand } from "@/components/order/order-brand-context";
import {
  customerAccentTextStyleFromAccent,
  customerActiveTabStyleFromAccent,
  customerPrimaryButtonStyleFromAccent,
} from "@/lib/brand/restaurant-brand";
import { cn, formatCurrency } from "@/lib/utils";
import type { Category, MenuItem } from "@/types/database";

function ItemCard({
  item,
  onSelect,
}: {
  item: MenuItem;
  onSelect: (item: MenuItem) => void;
}) {
  const { accent, customBrandingActive } = useOrderBrand();
  const unavailable = !item.is_available;
  const plusStyle = customerPrimaryButtonStyleFromAccent(accent, customBrandingActive);
  const accentTextStyle = customerAccentTextStyleFromAccent(accent);

  return (
    <div
      className={cn(
        "relative flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl border bg-card text-left shadow-sm",
        unavailable ? "pointer-events-none cursor-not-allowed opacity-60" : "transition-transform active:scale-[0.97]"
      )}
    >
      {!unavailable ? (
        <button type="button" onClick={() => onSelect(item)} className="flex flex-1 flex-col text-left">
          <ItemCardContent
            item={item}
            unavailable={false}
            plusStyle={plusStyle}
            accentTextStyle={accentTextStyle}
          />
        </button>
      ) : (
        <ItemCardContent item={item} unavailable plusStyle={plusStyle} accentTextStyle={accentTextStyle} />
      )}
    </div>
  );
}

function ItemCardContent({
  item,
  unavailable,
  plusStyle,
  accentTextStyle,
}: {
  item: MenuItem;
  unavailable: boolean;
  plusStyle: React.CSSProperties;
  accentTextStyle: React.CSSProperties;
}) {
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
          <span className="font-bold" style={accentTextStyle}>
            {formatCurrency(Number(item.price))}
          </span>
          {!unavailable && (
            <span
              className="flex h-7 w-7 items-center justify-center rounded-full"
              style={plusStyle}
            >
              <Plus className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </>
  );
}

type MenuTab = { id: string; label: string };

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
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const { accent, customBrandingActive } = useOrderBrand();

  const tabs = useMemo(() => {
    const items: MenuTab[] = [];
    if (topPicks.length > 0) items.push({ id: "top-picks", label: "Top Picks" });
    for (const category of categories) {
      if (menuItems.some((m) => m.category_id === category.id)) {
        items.push({ id: category.id, label: category.name });
      }
    }
    return items;
  }, [categories, menuItems, topPicks.length]);

  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  const sessionLabel =
    orderType === "dine-in"
      ? tableNumber
        ? `Fadhi · Miiska ${tableNumber}`
        : "Fadhi"
      : "Qaadasho";

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || tabs.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0];
        if (top?.target.id) setActiveTabId(top.target.id);
      },
      { root, rootMargin: "-30% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] }
    );

    for (const tab of tabs) {
      const node = sectionRefs.current[tab.id];
      if (node) observer.observe(node);
    }

    return () => observer.disconnect();
  }, [tabs]);

  function scrollToTab(tabId: string) {
    setActiveTabId(tabId);
    sectionRefs.current[tabId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 shrink-0 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">{restaurant.name}</p>
            <p className="text-xs text-muted-foreground">{sessionLabel}</p>
          </div>
          <div className="w-10" />
        </div>

        {tabs.length > 1 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto border-t px-4 py-2">
            {tabs.map((tab) => {
              const active = activeTabId === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => scrollToTab(tab.id)}
                  className={cn(
                    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200",
                    !active && "border-transparent bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                  style={active ? customerActiveTabStyleFromAccent(accent, customBrandingActive) : undefined}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className={cn("space-y-6 px-4 py-4", cartCount > 0 && "pb-28")}>
          {topPicks.length > 0 && (
            <section
              id="top-picks"
              ref={(node) => {
                sectionRefs.current["top-picks"] = node;
              }}
              className="scroll-mt-36"
            >
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
              <section
                key={category.id}
                id={category.id}
                ref={(node) => {
                  sectionRefs.current[category.id] = node;
                }}
                className="scroll-mt-36"
              >
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
          <OrderPrimaryButton size="lg" onClick={onOpenCart} className="w-full gap-2 rounded-full shadow-lg">
            <ShoppingBasket className="h-5 w-5" />
            Saladda ({cartCount})
          </OrderPrimaryButton>
        </div>
      )}
    </div>
  );
}
