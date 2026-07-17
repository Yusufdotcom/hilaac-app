"use client";

import { useCallback, useEffect, useRef } from "react";
import type { OrderWithItems } from "@/types/database";
import {
  playOrderBeep,
  requestStaffNotificationPermission,
  showNewOrderNotification,
  updateTabBadge,
} from "@/lib/staff/order-notifications";

/**
 * Browser alerts for staff dashboards: permission prompt, beep, notification, tab badge.
 */
export function useStaffOrderNotifications(pageTitle: string, restaurantName?: string) {
  const alertedOrderIds = useRef(new Set<string>());

  useEffect(() => {
    requestStaffNotificationPermission();
  }, []);

  const syncPendingBadge = useCallback(
    (orders: OrderWithItems[]) => {
      const pendingCount = orders.filter((order) => order.status === "new").length;
      updateTabBadge(pageTitle, pendingCount);
    },
    [pageTitle]
  );

  const alertNewOrder = useCallback(
    (order: OrderWithItems) => {
      if (order.status !== "new") return;
      if (alertedOrderIds.current.has(order.id)) return;

      alertedOrderIds.current.add(order.id);
      playOrderBeep();
      showNewOrderNotification(order, restaurantName);
    },
    [restaurantName]
  );

  return { alertNewOrder, syncPendingBadge };
}
