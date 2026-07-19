"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isKitchenVisible } from "@/lib/order/kitchen-visibility";
import type { OrderWithItems } from "@/types/database";

const ACTIVE_KITCHEN_STATUSES = ["new", "preparing", "ready"] as const;

function isActiveStatus(status: string) {
  return ACTIVE_KITCHEN_STATUSES.includes(status as (typeof ACTIVE_KITCHEN_STATUSES)[number]);
}

function sortByNewestFirst(orders: OrderWithItems[]) {
  return [...orders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/**
 * Subscribes to realtime order + order_item changes for a restaurant and
 * keeps a normalized, always-fresh list of orders (with their items joined)
 * for the kitchen / waiter / cashier dashboards.
 */
export function useRealtimeOrders(
  restaurantId: string,
  initialOrders: OrderWithItems[],
  options?: {
    activeOnly?: boolean;
    channelName?: string;
    onOrderRemoved?: (order: OrderWithItems, newStatus: string) => void;
    onNewOrder?: (order: OrderWithItems) => void;
    pinReadyToTop?: boolean;
    sortNewestFirst?: boolean;
    kitchenVisibleOnly?: boolean;
  }
) {
  const activeOnly = options?.activeOnly ?? true;
  const channelName = options?.channelName ?? `orders-${restaurantId}`;
  const onOrderRemoved = options?.onOrderRemoved;
  const onNewOrder = options?.onNewOrder;
  const pinReadyToTop = options?.pinReadyToTop ?? false;
  const sortNewestFirst = options?.sortNewestFirst ?? false;
  const kitchenVisibleOnly = options?.kitchenVisibleOnly ?? false;
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<OrderWithItems[]>(() =>
    sortNewestFirst ? sortByNewestFirst(initialOrders) : initialOrders
  );

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

  const passesFilters = useCallback(
    (order: OrderWithItems) => {
      if (kitchenVisibleOnly && !isKitchenVisible(order)) return false;
      if (activeOnly && !isActiveStatus(order.status)) return false;
      return true;
    },
    [activeOnly, kitchenVisibleOnly]
  );

  const mergeOrder = useCallback(
    (prev: OrderWithItems[], full: OrderWithItems) => {
      const without = prev.filter((o) => o.id !== full.id);

      if (!passesFilters(full)) {
        return without;
      }

      let next: OrderWithItems[];

      if (pinReadyToTop && full.status === "ready") {
        next = [full, ...without];
      } else if (sortNewestFirst) {
        next = sortByNewestFirst([full, ...without]);
      } else {
        next = [full, ...without];
      }

      return next;
    },
    [activeOnly, pinReadyToTop, sortNewestFirst, passesFilters]
  );

  useEffect(() => {
    const initial = kitchenVisibleOnly
      ? initialOrders.filter(isKitchenVisible)
      : initialOrders;
    setOrders(sortNewestFirst ? sortByNewestFirst(initial) : initial);
  }, [initialOrders, sortNewestFirst, kitchenVisibleOnly]);

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        async (payload) => {
          const full = await fetchOrder(payload.new.id as string);
          if (!full) return;
          if (!passesFilters(full)) return;

          setOrders((prev) => mergeOrder(prev, full));
          onNewOrder?.(full);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        async (payload) => {
          const updated = payload.new as { id: string; status?: string };
          const full = await fetchOrder(updated.id);

          if (!full) return;

          if (!passesFilters(full)) {
            let removedOrder: OrderWithItems | undefined;

            setOrders((prev) => {
              removedOrder = prev.find((o) => o.id === full.id);
              return prev.filter((o) => o.id !== full.id);
            });

            if (removedOrder && full.status) {
              onOrderRemoved?.(removedOrder, full.status);
            }
            return;
          }

          setOrders((prev) => mergeOrder(prev, full));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_items" },
        async (payload) => {
          const orderId = payload.new.order_id as string;
          const full = await fetchOrder(orderId);
          if (!full) return;

          setOrders((prev) => {
            if (!prev.some((o) => o.id === orderId) && passesFilters(full)) {
              return mergeOrder(prev, full);
            }
            return mergeOrder(prev, full);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    restaurantId,
    supabase,
    fetchOrder,
    activeOnly,
    onOrderRemoved,
    onNewOrder,
    channelName,
    mergeOrder,
    passesFilters,
  ]);

  function removeOrder(orderId: string) {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  }

  function restoreOrder(order: OrderWithItems) {
    setOrders((prev) => {
      if (prev.some((o) => o.id === order.id)) return prev;
      return mergeOrder(prev, order);
    });
  }

  async function updateOrderStatus(orderId: string, status: string) {
    let previous: OrderWithItems | undefined;

    setOrders((prev) => {
      previous = prev.find((o) => o.id === orderId);
      return prev.map((o) => (o.id === orderId ? { ...o, status: status as OrderWithItems["status"] } : o));
    });

    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);

    if (error && previous) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? previous! : o)));
    }

    return error;
  }

  async function updatePaymentStatus(orderId: string, payment_status: string) {
    let previous: OrderWithItems | undefined;

    setOrders((prev) => {
      previous = prev.find((o) => o.id === orderId);
      return prev.map((o) =>
        o.id === orderId ? { ...o, payment_status: payment_status as OrderWithItems["payment_status"] } : o
      );
    });

    const { error } = await supabase.from("orders").update({ payment_status }).eq("id", orderId);

    if (error && previous) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? previous! : o)));
    }

    return error;
  }

  async function updateOrderFields(
    orderId: string,
    fields: { status?: string; payment_status?: string; delivered_by?: string }
  ) {
    let previous: OrderWithItems | undefined;

    setOrders((prev) => {
      previous = prev.find((o) => o.id === orderId);
      const updated = prev.map((o) => (o.id === orderId ? { ...o, ...(fields as object) } : o));
      const nextOrder = updated.find((o) => o.id === orderId);
      if (nextOrder && !passesFilters(nextOrder)) {
        if (previous) {
          onOrderRemoved?.(previous, fields.status ?? previous.status);
        }
        return updated.filter((o) => o.id !== orderId);
      }
      if (activeOnly && fields.status && !isActiveStatus(fields.status)) {
        if (previous) {
          onOrderRemoved?.(previous, fields.status);
        }
        return updated.filter((o) => o.id !== orderId);
      }
      return updated;
    });

    const { error } = await supabase.from("orders").update(fields).eq("id", orderId);

    if (error && previous) {
      setOrders((prev) => {
        if (prev.some((o) => o.id === orderId)) {
          return prev.map((o) => (o.id === orderId ? previous! : o));
        }
        return mergeOrder(prev, previous!);
      });
    }

    return error;
  }

  return { orders, removeOrder, restoreOrder, updateOrderStatus, updatePaymentStatus, updateOrderFields };
}
