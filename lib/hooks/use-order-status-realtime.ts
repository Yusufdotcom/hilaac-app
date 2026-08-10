"use client";

import { useEffect, useState } from "react";
import type { LoyaltyCustomerStatus } from "@/lib/loyalty/types";
import { loadOrderAccessToken } from "@/lib/order/order-access-storage";
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

const POLL_MS = 4000;

async function fetchTrack(orderId: string) {
  const accessToken = loadOrderAccessToken(orderId);
  const url = accessToken
    ? `/api/orders/${orderId}/track?accessToken=${encodeURIComponent(accessToken)}`
    : `/api/orders/${orderId}/track`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.order) {
    const apiError = typeof data.error === "string" ? data.error : null;
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false as const,
        error:
          apiError ??
          "To view this order on a new device, re-enter the phone number used when you ordered.",
      };
    }
    return {
      ok: false as const,
      error: apiError ?? "Could not load order status.",
    };
  }
  return {
    ok: true as const,
    order: data.order as TrackedOrder,
    loyalty: (data.loyalty as LoyaltyCustomerStatus | null) ?? null,
  };
}

/**
 * Loads + refreshes a single order by id via GET /api/orders/[id]/track.
 * Requires the order access token saved at checkout (localStorage), or a reminted token.
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

    async function load() {
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

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [orderId]);

  return state;
}
