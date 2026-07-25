"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Star,
  UtensilsCrossed,
  Plus,
  X,
  GlassWater,
  Utensils,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CartTrayFab } from "@/components/order/cart-tray-fab";
import { useOrderBrand } from "@/components/order/order-brand-context";
import {
  brandColorWithAlpha,
  customerAccentTextStyleFromAccent,
  customerActiveTabStyleFromAccent,
  customerPrimaryButtonStyleFromAccent,
} from "@/lib/brand/restaurant-brand";
import {
  findDrinksCategory,
  isDrinksCategoryName,
  splitMenuCategories,
} from "@/lib/order/drinks-category";
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
        "relative flex w-40 shrink-0 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-left shadow-sm",
        unavailable
          ? "pointer-events-none cursor-not-allowed opacity-60"
          : "transition-transform active:scale-[0.97]"
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
              className="flex h-7 w-7 items-center justify-center rounded-full shadow-sm"
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
type MenuFocus = "food" | "drinks";

export function MenuStep({
  restaurant,
  categories,
  menuItems,
  topPicks,
  orderType,
  tableNumber,
  cartCount,
  cartBumpKey = 0,
  showDrinksUpsell = false,
  onDismissDrinksUpsell,
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
  cartBumpKey?: number;
  showDrinksUpsell?: boolean;
  onDismissDrinksUpsell?: () => void;
  onBack: () => void;
  onSelectItem: (item: MenuItem) => void;
  onOpenCart: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const { accent, customBrandingActive } = useOrderBrand();

  const { food: foodCategories, drinks: drinksCategories } = useMemo(
    () => splitMenuCategories(categories),
    [categories]
  );

  const hasFood = foodCategories.some((c) => menuItems.some((m) => m.category_id === c.id));
  const hasDrinks = drinksCategories.some((c) => menuItems.some((m) => m.category_id === c.id));
  const showFocusToggle = hasFood && hasDrinks;

  const [menuFocus, setMenuFocus] = useState<MenuFocus>("food");

  useEffect(() => {
    if (showFocusToggle) return;
    if (hasDrinks && !hasFood) setMenuFocus("drinks");
    if (hasFood && !hasDrinks) setMenuFocus("food");
  }, [showFocusToggle, hasDrinks, hasFood]);

  const visibleCategories = useMemo(() => {
    if (!showFocusToggle) return categories;
    return menuFocus === "drinks" ? drinksCategories : foodCategories;
  }, [showFocusToggle, menuFocus, categories, drinksCategories, foodCategories]);

  const drinksCategory = useMemo(() => findDrinksCategory(categories), [categories]);

  const visibleTopPicks = useMemo(() => {
    if (!showFocusToggle) return topPicks;
    return topPicks.filter((item) => {
      const cat = categories.find((c) => c.id === item.category_id);
      if (!cat) return menuFocus === "food";
      const isDrink = isDrinksCategoryName(cat.name);
      return menuFocus === "drinks" ? isDrink : !isDrink;
    });
  }, [topPicks, showFocusToggle, menuFocus, categories]);

  const tabs = useMemo(() => {
    const items: MenuTab[] = [];
    if (visibleTopPicks.length > 0) items.push({ id: "top-picks", label: "Top Picks" });
    for (const category of visibleCategories) {
      if (menuItems.some((m) => m.category_id === category.id)) {
        items.push({ id: category.id, label: category.name });
      }
    }
    return items;
  }, [visibleCategories, menuItems, visibleTopPicks.length]);

  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? "");

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.id === activeTabId)) {
      setActiveTabId(tabs[0].id);
    }
  }, [tabs, activeTabId]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
  }, [menuFocus]);

  const sessionLabel =
    orderType === "dine-in"
      ? tableNumber
        ? `Fadhi · Table ${tableNumber}`
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
  }, [tabs, menuFocus]);

  function scrollToTab(tabId: string) {
    setActiveTabId(tabId);
    sectionRefs.current[tabId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleDrinksUpsellClick() {
    if (drinksCategory) {
      if (showFocusToggle) setMenuFocus("drinks");
      window.setTimeout(() => scrollToTab(drinksCategory.id), showFocusToggle ? 50 : 0);
    }
    onDismissDrinksUpsell?.();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-3 motion-safe:duration-300">
      <header className="sticky top-0 z-20 shrink-0 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 rounded-lg text-sm text-muted-foreground transition-colors active:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">{restaurant.name}</p>
            <p className="text-xs text-muted-foreground">{sessionLabel}</p>
          </div>
          <div className="w-10" />
        </div>

        {showFocusToggle && (
          <div className="flex justify-center gap-3 px-4 pb-3 pt-1">
            {(
              [
                { id: "food" as const, label: "Cunno", Icon: Utensils },
                { id: "drinks" as const, label: "Cabitaan", Icon: GlassWater },
              ] as const
            ).map(({ id, label, Icon }) => {
              const active = menuFocus === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMenuFocus(id)}
                  className={cn(
                    "flex min-w-[7.5rem] flex-col items-center gap-1.5 rounded-2xl border-2 px-5 py-3.5",
                    "text-sm font-bold shadow-sm transition-all duration-200 active:scale-[0.97]",
                    !active && "border-border/70 bg-muted/40 text-muted-foreground"
                  )}
                  style={
                    active
                      ? {
                          borderColor: accent,
                          backgroundColor: brandColorWithAlpha(accent, 0.12),
                          color: accent,
                          boxShadow: `0 8px 20px ${brandColorWithAlpha(accent, 0.2)}`,
                        }
                      : undefined
                  }
                  aria-pressed={active}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        )}

        {tabs.length > 1 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto border-t border-border/50 px-4 py-2">
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

      {showDrinksUpsell && drinksCategory && menuFocus === "food" && (
        <div
          className="shrink-0 border-b border-border/50 px-4 py-2.5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2"
          style={{ backgroundColor: brandColorWithAlpha(accent, 0.08) }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleDrinksUpsellClick}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: brandColorWithAlpha(accent, 0.18),
                  color: accent,
                }}
              >
                <GlassWater className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">Add a drink?</span>
                <span className="block truncate text-xs text-muted-foreground">
                  Browse {drinksCategory.name}
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDismissDrinksUpsell?.()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background/80 hover:text-foreground"
              aria-label="Dismiss drinks suggestion"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <div className={cn("space-y-6 px-4 py-4", cartCount > 0 && "pb-28")}>
          {visibleTopPicks.length > 0 && (
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
                {visibleTopPicks.map((item) => (
                  <ItemCard key={item.id} item={item} onSelect={onSelectItem} />
                ))}
              </div>
            </section>
          )}

          {visibleCategories.map((category) => {
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

      <CartTrayFab count={cartCount} bumpKey={cartBumpKey} onOpen={onOpenCart} />
    </div>
  );
}
