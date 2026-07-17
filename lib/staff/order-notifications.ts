import type { OrderWithItems } from "@/types/database";
import { formatOrderLabel } from "@/lib/utils";

let originalFaviconHref: string | null = null;
let originalDocumentTitle: string | null = null;

/** Subtle beep via Web Audio API (no external asset required). */
export function playOrderBeep() {
  if (typeof window === "undefined") return;

  try {
    const AudioCtx = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.value = 0.06;

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.12);

    oscillator.onended = () => {
      void ctx.close();
    };
  } catch {
    // Ignore if audio is blocked.
  }
}

export function showNewOrderNotification(order: OrderWithItems, restaurantName?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const label = formatOrderLabel(order);
  const body =
    order.order_type === "dine-in" && order.table?.table_number
      ? `Table ${order.table.table_number} · ${restaurantName ?? "New order"}`
      : `Takeaway · ${restaurantName ?? "New order"}`;

  try {
    new Notification(`New order ${label}`, {
      body,
      tag: `order-${order.id}`,
      silent: true,
    });
  } catch {
    // Ignore notification errors.
  }
}

export function requestStaffNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    void Notification.requestPermission();
  }
}

function getFaviconLink() {
  if (typeof document === "undefined") return null;
  return document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
}

export function updateTabBadge(pageTitle: string, pendingCount: number) {
  if (typeof document === "undefined") return;

  if (originalDocumentTitle === null) {
    originalDocumentTitle = pageTitle;
  }

  document.title = pendingCount > 0 ? `(${pendingCount}) ${pageTitle}` : pageTitle;

  const link = getFaviconLink();
  if (!link) return;

  if (originalFaviconHref === null) {
    originalFaviconHref = link.href;
  }

  if (pendingCount <= 0) {
    link.href = originalFaviconHref;
    return;
  }

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, 0, 0, 32, 32);
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(24, 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    link.href = canvas.toDataURL("image/png");
  };
  img.onerror = () => {
    // Fallback: title badge only if favicon can't be loaded.
  };
  img.src = originalFaviconHref;
}
