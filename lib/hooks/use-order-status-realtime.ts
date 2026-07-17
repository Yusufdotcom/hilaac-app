"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderStatus, PaymentStatus } from "@/types/database";

export interface TrackedOrder {
  id: string;
  order_number: number | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
}

/**
 * Loads an order's status once, then keeps it in sync via Supabase Realtime
 * UPDATE events on the specific orders row.
 */
export function useOrderStatusRealtime(orderId: string) {
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function loadInitial() {
      try {
        const res = await fetch(`/api/orders/${orderId}/track`, { cache: "no-store" });
        const data = await res.json();
        if (active && res.ok) setOrder(data.order);
      } catch {
        // Realtime updates may still arrive; ignore transient fetch errors.
      }
    }

    void loadInitial();

    const channel = supabase
      .channel(`order-status-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          const updated = payload.new as TrackedOrder;
          setOrder({
            id: updated.id,
            order_number: updated.order_number ?? null,
            status: updated.status,
            payment_status: updated.payment_status,
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [orderId]);

  return order;
}
