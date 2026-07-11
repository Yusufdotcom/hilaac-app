"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderWithItems } from "@/types/database";

/**
 * Subscribes to realtime order + order_item changes for a restaurant and
 * keeps a normalized, always-fresh list of orders (with their items joined)
 * for the kitchen / waiter / cashier dashboards.
 */
export function useRealtimeOrders(
  restaurantId: string,
  initialOrders: OrderWithItems[],
  options?: { activeOnly?: boolean }
) {
  const activeOnly = options?.activeOnly ?? true;
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderWithItems[]>(initialOrders);

  const fetchOrder = useCallback(
    async (orderId: string) => {
      const { data } = await supabase
        .from("orders")
        .select("*, table:table_id(*), order_items(*, menu_item:menu_item_id(*))")
        .eq("id", orderId)
        .single();
      return data as OrderWithItems | null;
    },
    [supabase]
  );

  useEffect(() => {
    const channel = supabase
      .channel(`orders-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        async (payload) => {
          const full = await fetchOrder(payload.new.id as string);
          if (full) setOrders((prev) => [full, ...prev.filter((o) => o.id !== full.id)]);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        (payload) => {
          const updated = payload.new as { id: string; status?: string };
          if (activeOnly && updated.status && !["new", "preparing", "ready"].includes(updated.status)) {
            setOrders((prev) => prev.filter((o) => o.id !== updated.id));
            return;
          }
          setOrders((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...(payload.new as object) } : o)));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_items" },
        async (payload) => {
          const orderId = payload.new.order_id as string;
          setOrders((prev) => {
            if (!prev.some((o) => o.id === orderId)) return prev;
            return prev;
          });
          const full = await fetchOrder(orderId);
          if (full) setOrders((prev) => prev.map((o) => (o.id === orderId ? full : o)));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, supabase, fetchOrder, activeOnly]);

  async function updateOrderStatus(orderId: string, status: string) {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: status as any } : o)));
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    return error;
  }

  async function updatePaymentStatus(orderId: string, payment_status: string) {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, payment_status: payment_status as any } : o))
    );
    const { error } = await supabase.from("orders").update({ payment_status }).eq("id", orderId);
    return error;
  }

  async function updateOrderFields(
    orderId: string,
    fields: { status?: string; payment_status?: string }
  ) {
    setOrders((prev) => {
      const updated = prev.map((o) => (o.id === orderId ? { ...o, ...(fields as object) } : o));
      if (
        activeOnly &&
        fields.status &&
        !["new", "preparing", "ready"].includes(fields.status)
      ) {
        return updated.filter((o) => o.id !== orderId);
      }
      return updated;
    });
    const { error } = await supabase.from("orders").update(fields).eq("id", orderId);
    return error;
  }

  return { orders, updateOrderStatus, updatePaymentStatus, updateOrderFields };
}
