"use client";

import { Button, type ButtonProps } from "@/components/ui/button";
import { resolveBrandColor } from "@/lib/brand/restaurant-brand";
import { cn } from "@/lib/utils";
import { useAdminBrandColor } from "@/components/admin/admin-brand-context";

const BRAND_VARIANTS = new Set(["default", "brand", "success"]);

export function BrandButton({ className, style, variant = "default", ...props }: ButtonProps) {
  const brandColor = useAdminBrandColor();
  const accent = resolveBrandColor(brandColor);
  const useBrand = BRAND_VARIANTS.has(variant ?? "default");

  return (
    <Button
      {...props}
      variant={useBrand ? "brand" : variant}
      className={cn(useBrand && "text-white hover:opacity-90", className)}
      style={useBrand ? { backgroundColor: accent, ...style } : style}
    />
  );
}
