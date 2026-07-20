"use client";

import { cn } from "@/lib/utils";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { useAdminBrandColor } from "@/components/admin/admin-brand-context";
import { brandColorWithAlpha } from "@/lib/brand/restaurant-brand";

export function BrandRadioOption({
  value,
  selectedValue,
  id,
  children,
  className,
}: {
  value: string;
  selectedValue: string;
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const accent = useAdminBrandColor();
  const selected = value === selectedValue;

  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors",
        className
      )}
      style={
        selected
          ? {
              borderColor: accent,
              backgroundColor: brandColorWithAlpha(accent, 0.1),
            }
          : undefined
      }
    >
      <RadioGroupItem value={value} id={id} />
      {children}
    </label>
  );
}
