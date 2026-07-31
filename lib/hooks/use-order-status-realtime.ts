"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LoyaltyCustomerStatus } from "@/lib/loyalty/types";
import type { BillingModel, OrderStatus, OrderType, PaymentStatus } from "@/types/database";

export interface TrackedOrder {
  id: string;
  order_number: number | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  billing_model: BillingModel | null;
  customer_confirmed_at: string | null;
  customer_phone: string | null;
  order_type: OrderType | null;
}

export type OrderStatusLoadState =
  | { status: "loading"; order: null; loyalty: null; error: null }
  | { status: "ready"; order: TrackedOrder; loyalty: LoyaltyCustomerStatus | null; error: null }
  | { status: "error"; order: null; loyalty: null; error: string };

async function fetchTrack(orderId: string) {
  const res = await fetch(`/api/orders/${orderId}/track`, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.order) {
    return {
      ok: false as const,
      error: (data.error as string) ?? "Could not load order status.",
    };
  }
  return {
    ok: true as const,
    order: data.order as TrackedOrder,
    loyalty: (data.loyalty as LoyaltyCustomerStatus | null) ?? null,
  };
}

/**
 * Loads order status via the public track API (service role — works for guests),
 * then keeps it in sync via Supabase Realtime (anon key + RLS SELECT).
 * Refetches loyalty when the order becomes delivered/completed.
 */
export function useOrderStatusRealtime(orderId: string): OrderStatusLoadState {
  const [state, setState] = useState<OrderStatusLoadState>({
    status: "loading",
    order: null,
    loyalty: null,
    error: null,
  });

  useEffect(() => {
    if (!orderId) {
      setState({
        status: "error",
        order: null,
        loyalty: null,
        error: "Missing order id.",
      });
      return;
    }

    let active = true;
    const supabase = createClient();

    async function loadInitial() {
      try {
        const result = await fetchTrack(orderId);
        if (!active) return;

        if (!result.ok) {
          setState({
            status: "error",
            order: null,
            loyalty: null,
            error: result.error,
          });
          return;
        }

        setState({
          status: "ready",
          order: result.order,
          loyalty: result.loyalty,
          error: null,
        });
      } catch {
        if (!active) return;
        setState({
          status: "error",
          order: null,
          loyalty: null,
          error: "Could not load order status. Check your connection and try again.",
        });
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
          setState((prev) => {
            const base = prev.status === "ready" ? prev.order : null;
            const prevLoyalty = prev.status === "ready" ? prev.loyalty : null;
            return {
              status: "ready",
              error: null,
              loyalty: prevLoyalty,
              order: {
                id: updated.id,
                order_number: updated.order_number ?? null,
                status: updated.status,
                payment_status: updated.payment_status,
                billing_model: updated.billing_model ?? null,
                customer_confirmed_at: updated.customer_confirmed_at ?? null,
                customer_phone: updated.customer_phone ?? null,
                order_type: updated.order_type ?? base?.order_type ?? null,
              },
            };
          });

          // Punch-card credits on delivered — refresh loyalty snapshot.
          if (updated.status === "delivered" || updated.status === "completed") {
            void fetchTrack(orderId).then((result) => {
              if (!active || !result.ok) return;
              setState((prev) =>
                prev.status === "ready"
                  ? { ...prev, loyalty: result.loyalty, order: { ...prev.order, ...result.order } }
                  : prev
              );
            });
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [orderId]);

  return state;
}
