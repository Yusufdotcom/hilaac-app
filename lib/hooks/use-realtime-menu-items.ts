"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MenuItem } from "@/types/database";

/**
 * Subscribes to menu_items UPDATE events for a restaurant so availability
 * changes (86'd) propagate instantly to customer and kitchen UIs.
 */
export function useRealtimeMenuItems(restaurantId: string, initialMenuItems: MenuItem[]) {
  const supabase = createClient();
  const [menuItems, setMenuItems] = useState<MenuItem[]>(initialMenuItems);

  useEffect(() => {
    setMenuItems(initialMenuItems);
  }, [initialMenuItems]);

  useEffect(() => {
    const channel = supabase
      .channel(`menu-items-${restaurantId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "menu_items",
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const updated = payload.new as MenuItem;
          setMenuItems((prev) =>
            prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [restaurantId, supabase]);

  const toggleAvailability = useCallback(
    async (itemId: string, nextAvailable: boolean) => {
      setMenuItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, is_available: nextAvailable } : item))
      );

      const { error } = await supabase
        .from("menu_items")
        .update({ is_available: nextAvailable })
        .eq("id", itemId);

      if (error) {
        setMenuItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, is_available: !nextAvailable } : item
          )
        );
      }

      return error;
    },
    [supabase]
  );

  return { menuItems, toggleAvailability };
}
