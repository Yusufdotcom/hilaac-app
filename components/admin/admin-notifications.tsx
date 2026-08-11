"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminNotificationItem } from "@/app/api/admin/notifications/route";

export function AdminNotifications({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AdminNotificationItem[]>([]);
  const [badge, setBadge] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/notifications", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setItems(data.items ?? []);
        setBadge(Number(data.badgeCount ?? 0));
      } catch {
        // ignore
      }
    }
    void load();
    const t = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-bg)]"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px] text-[var(--admin-muted)]" />
        {badge > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: "var(--admin-brand, #9E2E2E)" }}
          >
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </button>

      {open && (
        <div className="admin-glass-panel absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,20rem)] overflow-hidden rounded-xl">
          <div className="border-b border-[var(--admin-border)] px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-[var(--admin-muted)]">
              Pending confirmations &amp; insights
            </p>
          </div>
          <ul className="max-h-80 overflow-y-auto py-1">
            {items.length === 0 && (
              <li className="px-4 py-6 text-center text-sm text-[var(--admin-muted)]">
                You&apos;re all caught up
              </li>
            )}
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 transition-colors hover:bg-[var(--admin-subtle)]"
                >
                  <p className="text-sm font-medium text-[var(--admin-text)]">{item.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--admin-muted)]">{item.body}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
