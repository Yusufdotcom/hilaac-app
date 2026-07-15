"use client";

import { Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRealtimeMenuItems } from "@/lib/hooks/use-realtime-menu-items";
import type { MenuItem } from "@/types/database";

export function KitchenMenuAvailability({
  restaurantId,
  initialMenuItems,
}: {
  restaurantId: string;
  initialMenuItems: MenuItem[];
}) {
  const { menuItems, toggleAvailability } = useRealtimeMenuItems(restaurantId, initialMenuItems);

  const sortedItems = [...menuItems].sort((a, b) => a.name.localeCompare(b.name));
  const unavailableCount = menuItems.filter((item) => !item.is_available).length;

  async function handleToggle(item: MenuItem) {
    const nextAvailable = !item.is_available;
    const error = await toggleAvailability(item.id, nextAvailable);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(nextAvailable ? `${item.name} is available again` : `${item.name} marked Ma Jiro`);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#0F172A]">Menu availability</h2>
          <p className="text-sm text-[#64748B]">Mark items as Ma Jiro when you run out.</p>
        </div>
        {unavailableCount > 0 && (
          <Badge className="border-0 bg-black/80 text-white">{unavailableCount} Ma Jiro</Badge>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sortedItems.map((item) => {
          const unavailable = !item.is_available;
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm",
                unavailable && "opacity-60"
              )}
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-[#0F172A]">{item.name}</p>
                {unavailable && (
                  <Badge className="mt-1 border-0 bg-black/75 text-[10px] text-white">Ma Jiro</Badge>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant={unavailable ? "outline" : "secondary"}
                className={cn(
                  "shrink-0 gap-1.5",
                  unavailable && "border-[#0F172A] text-[#0F172A]"
                )}
                onClick={() => void handleToggle(item)}
              >
                {unavailable ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Restock
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4" aria-hidden="true" />
                    Ma Jiro
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
