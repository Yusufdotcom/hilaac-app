"use client";

import { useEffect } from "react";

const DEFAULT_ICON = "/logo-icon.png";

/**
 * Sets document favicon to the restaurant logo while on admin pages.
 * Restores Hilaac mark on unmount (leaving admin).
 */
export function AdminFavicon({ logoUrl }: { logoUrl?: string | null }) {
  useEffect(() => {
    const href = logoUrl?.trim() || DEFAULT_ICON;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    const prev = link.href;
    link.href = href;
    link.type = href.endsWith(".svg") ? "image/svg+xml" : "image/png";

    let apple = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    if (!apple) {
      apple = document.createElement("link");
      apple.rel = "apple-touch-icon";
      document.head.appendChild(apple);
    }
    const prevApple = apple.href;
    apple.href = href;

    return () => {
      if (link) link.href = prev || DEFAULT_ICON;
      if (apple) apple.href = prevApple || DEFAULT_ICON;
    };
  }, [logoUrl]);

  return null;
}
