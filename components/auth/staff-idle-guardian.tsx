"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  getStaffIdleTimeoutMs,
  STAFF_IDLE_WARN_MS,
} from "@/lib/auth/staff-idle";
import type { UserRole } from "@/types/database";

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "pointerdown",
];

/**
 * Signs out staff after inactivity on admin/staff shells.
 * Privileged roles (owner/manager) use a shorter timeout than floor staff.
 */
export function StaffIdleGuardian({ role }: { role?: UserRole | null }) {
  const router = useRouter();
  const lastActivityRef = useRef(Date.now());
  const warnedRef = useRef(false);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    const timeoutMs = getStaffIdleTimeoutMs(role);
    const warnAt = Math.max(timeoutMs - STAFF_IDLE_WARN_MS, timeoutMs * 0.9);

    const markActivity = () => {
      lastActivityRef.current = Date.now();
      if (warnedRef.current) {
        warnedRef.current = false;
        toast.dismiss("staff-idle-warn");
      }
    };

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActivity, { passive: true });
    }

    const tick = window.setInterval(async () => {
      if (loggingOutRef.current) return;
      const idleMs = Date.now() - lastActivityRef.current;

      if (idleMs >= warnAt && idleMs < timeoutMs && !warnedRef.current) {
        warnedRef.current = true;
        const secondsLeft = Math.max(1, Math.ceil((timeoutMs - idleMs) / 1000));
        toast.warning(
          `Signing out soon due to inactivity (${secondsLeft}s). Move or click to stay signed in.`,
          {
            id: "staff-idle-warn",
            duration: STAFF_IDLE_WARN_MS,
          }
        );
      }

      if (idleMs < timeoutMs) return;

      loggingOutRef.current = true;
      toast.dismiss("staff-idle-warn");
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {
        /* still redirect */
      }
      router.replace("/login?error=idle");
    }, 5_000);

    return () => {
      window.clearInterval(tick);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActivity);
      }
    };
  }, [router, role]);

  return null;
}
