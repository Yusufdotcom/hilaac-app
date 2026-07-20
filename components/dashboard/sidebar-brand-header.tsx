"use client";

import Image from "next/image";
import { Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SIDEBAR_TEXT_COLOR, subscriptionPlanLabel } from "@/lib/brand/restaurant-brand";

export function SidebarBrandHeader({
  name,
  logoUrl,
  subscriptionTier,
  compact = false,
}: {
  name: string;
  logoUrl: string | null;
  subscriptionTier: string;
  brandColor?: string | null;
  compact?: boolean;
}) {
  const isPro = subscriptionTier === "pro";

  return (
    <div className={cn("shrink-0 border-b border-white/10 px-4 py-5", compact && "px-3 py-4")}>
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5",
            compact ? "h-10 w-10" : "h-12 w-12"
          )}
        >
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt=""
              fill
              className="object-cover"
              sizes="48px"
              unoptimized
            />
          ) : (
            <Store className={cn("text-white/70", compact ? "h-5 w-5" : "h-6 w-6")} aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate font-bold leading-tight",
              compact ? "text-sm" : "text-base"
            )}
            style={{ color: SIDEBAR_TEXT_COLOR }}
            title={name}
          >
            {name}
          </p>
          <Badge
            className={cn(
              "mt-1.5 border-0 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              isPro ? "bg-white/20 hover:bg-white/20" : "bg-white/10 hover:bg-white/10"
            )}
            style={{ color: isPro ? SIDEBAR_TEXT_COLOR : "rgba(255,255,255,0.7)" }}
          >
            {subscriptionPlanLabel(subscriptionTier)}
          </Badge>
        </div>
      </div>
    </div>
  );
}
