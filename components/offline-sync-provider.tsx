"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { getQueue, syncOfflineOrders } from "@/lib/offline-queue";

/**
 * Watches connectivity and flushes the offline order queue when the
 * browser comes back online. All writes go through /api/orders/create.
 */
export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useOnlineStatus();
  const wasOfflineRef = useRef(false);
  const hasMountedRef = useRef(false);

  async function runSync(showStartToast: boolean) {
    const pending = getQueue().filter((item) => !item.synced);
    if (pending.length === 0) return;

    if (showStartToast) {
      toast.message("Syncing offline orders...");
    }

    const { synced, failed } = await syncOfflineOrders();

    if (synced > 0) {
      toast.success(
        synced === 1
          ? "1 offline order synced successfully."
          : `${synced} offline orders synced successfully.`
      );
    }
    if (failed > 0) {
      toast.error(
        failed === 1
          ? "1 offline order could not be synced yet."
          : `${failed} offline orders could not be synced yet.`
      );
    }
  }

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
      return;
    }

    if (!wasOfflineRef.current && hasMountedRef.current) return;

    wasOfflineRef.current = false;
    void runSync(true);
  }, [isOnline]);

  // Sync any leftover queue entries on first load when already online.
  useEffect(() => {
    hasMountedRef.current = true;
    if (!navigator.onLine) return;
    void runSync(false);
  }, []);

  return <>{children}</>;
}
