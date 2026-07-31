"use client";

import Image from "next/image";
import { UtensilsCrossed, ShoppingBag, ChefHat } from "lucide-react";
import { useOrderBrand } from "@/components/order/order-brand-context";
import { useOrderAppearance } from "@/components/order/order-appearance-context";
import { OrderThemeToggle } from "@/components/order/order-theme-toggle";
import {
  brandColorWithAlpha,
  customerAccentTextStyleFromAccent,
  customerSelectionIconStyleFromAccent,
} from "@/lib/brand/restaurant-brand";
import { getTimeOfDayGreeting, HERO_IMAGE_MIN } from "@/lib/order/appearance";
import { cn } from "@/lib/utils";
import type { MenuItem, OrderType } from "@/types/database";

const FLOAT_LAYOUT = [
  { rotate: "-8deg", x: "8%", y: "12%", z: 1, size: "w-[38%] max-w-[9.5rem]" },
  { rotate: "6deg", x: "52%", y: "6%", z: 3, size: "w-[42%] max-w-[10.5rem]" },
  { rotate: "-4deg", x: "28%", y: "38%", z: 2, size: "w-[36%] max-w-[9rem]" },
  { rotate: "10deg", x: "58%", y: "42%", z: 4, size: "w-[34%] max-w-[8.5rem]" },
] as const;

function FloatingHero({ items, isDark }: { items: MenuItem[]; isDark: boolean }) {
  const shown = items.slice(0, FLOAT_LAYOUT.length);

  return (
    <div className="relative mx-auto h-[min(42vw,220px)] w-full max-w-md overflow-hidden">
      {shown.map((item, index) => {
        const layout = FLOAT_LAYOUT[index]!;
        return (
          <div
            key={item.id}
            className={cn(
              "absolute overflow-hidden rounded-2xl",
              "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-700",
              layout.size
            )}
            style={{
              left: layout.x,
              top: layout.y,
              zIndex: layout.z,
              transform: `rotate(${layout.rotate})`,
              animationDelay: `${index * 80}ms`,
              boxShadow: isDark
                ? "0 18px 40px rgba(0,0,0,0.45)"
                : "0 14px 32px rgba(60,40,20,0.16)",
            }}
          >
            <div className="relative aspect-[4/5] w-full bg-muted">
              <Image
                src={item.image_url!}
                alt=""
                fill
                sizes="(max-width: 480px) 42vw, 168px"
                quality={65}
                loading={index === 0 ? "eager" : "lazy"}
                priority={index === 0}
                className="object-cover"
              />
              {/* Soft skeleton underpaint while decoding */}
              <div className="absolute inset-0 -z-10 animate-pulse bg-stone-300/40 dark:bg-stone-700/40" />
            </div>
          </div>
        );
      })}

      {/* Fade into page background */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3"
        style={{
          background: isDark
            ? "linear-gradient(to top, hsl(24 18% 10%) 8%, transparent)"
            : "linear-gradient(to top, hsl(36 40% 96%) 8%, transparent)",
        }}
        aria-hidden="true"
      />
    </div>
  );
}

function OrderTypeCard({
  type,
  icon: Icon,
  title,
  description,
  onSelect,
  isDark,
}: {
  type: OrderType;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onSelect: (type: OrderType) => void;
  isDark: boolean;
}) {
  const { accent, customBrandingActive } = useOrderBrand();

  return (
    <button
      type="button"
      onClick={() => onSelect(type)}
      className={cn(
        "flex w-full min-h-[4.5rem] items-center gap-4 rounded-2xl border p-5 text-left",
        "backdrop-blur-md transition-all duration-200 ease-out active:scale-[0.98]",
        isDark
          ? "border-white/15 bg-white/10 shadow-[0_8px_28px_rgba(0,0,0,0.28)] hover:bg-white/[0.14]"
          : "border-stone-900/10 bg-white/65 shadow-[0_8px_24px_rgba(60,40,20,0.08)] hover:bg-white/80"
      )}
      style={{
        boxShadow: `0 8px 28px ${brandColorWithAlpha(accent, isDark ? 0.18 : 0.12)}`,
      }}
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-200"
        style={customerSelectionIconStyleFromAccent(accent, true, customBrandingActive)}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div>
        <p
          className={cn(
            "text-lg font-bold",
            isDark ? "text-stone-50" : "text-stone-900"
          )}
        >
          {title}
        </p>
        <p
          className={cn(
            "text-sm",
            isDark ? "text-stone-300" : "text-stone-600"
          )}
        >
          {description}
        </p>
      </div>
    </button>
  );
}

export function LandingStep({
  restaurant,
  heroItems = [],
  onSelect,
  className,
}: {
  restaurant: {
    name: string;
    logo_url: string | null;
    dine_in_enabled: boolean;
    takeaway_enabled: boolean;
  };
  /** Pre-filtered menu items with images (≥3) or empty for fallback. */
  heroItems?: MenuItem[];
  onSelect: (type: OrderType) => void;
  className?: string;
}) {
  const { accent } = useOrderBrand();
  const { theme } = useOrderAppearance();
  const isDark = theme === "dark";
  const accentTextStyle = customerAccentTextStyleFromAccent(accent);
  const greeting = getTimeOfDayGreeting();
  const showHero = heroItems.length >= HERO_IMAGE_MIN;

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden",
        "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-400",
        className
      )}
    >
      <div className="absolute right-4 top-4 z-20 sm:right-5 sm:top-5">
        <OrderThemeToggle />
      </div>

      {showHero ? (
        <div className="relative shrink-0 px-4 pt-10">
          <FloatingHero items={heroItems} isDark={isDark} />
        </div>
      ) : (
        <div className="flex shrink-0 justify-center px-6 pt-14">
          <div
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full shadow-md"
            style={{ backgroundColor: brandColorWithAlpha(accent, isDark ? 0.22 : 0.12) }}
          >
            {restaurant.logo_url ? (
              <Image
                src={restaurant.logo_url}
                alt={restaurant.name}
                width={80}
                height={80}
                className="h-full w-full object-cover"
                sizes="80px"
                quality={70}
                priority
              />
            ) : (
              <ChefHat className="h-9 w-9" style={accentTextStyle} aria-hidden="true" />
            )}
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-6 pt-2 text-center">
        <p
          className={cn(
            "text-sm font-medium tracking-wide",
            isDark ? "text-stone-300" : "text-stone-600"
          )}
        >
          {greeting}
        </p>
        <h1
          className={cn(
            "mt-1 text-2xl font-bold tracking-tight sm:text-[1.7rem]",
            isDark ? "text-stone-50" : "text-stone-900"
          )}
        >
          Kusoo dhawaaw {restaurant.name}
        </h1>
        <p className={cn("mt-1.5 text-sm", isDark ? "text-stone-400" : "text-stone-600")}>
          Fadlan dooro nooca dalabkaaga
        </p>

        <div className="mt-7 grid w-full max-w-sm gap-3">
          {restaurant.dine_in_enabled && (
            <OrderTypeCard
              type="dine-in"
              icon={UtensilsCrossed}
              title="Fadhi"
              description="Dine-in at your table"
              onSelect={onSelect}
              isDark={isDark}
            />
          )}

          {restaurant.takeaway_enabled && (
            <OrderTypeCard
              type="takeaway"
              icon={ShoppingBag}
              title="Qaadasho"
              description="Takeaway / pickup"
              onSelect={onSelect}
              isDark={isDark}
            />
          )}
        </div>
      </div>
    </div>
  );
}
