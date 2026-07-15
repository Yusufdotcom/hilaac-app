"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

const EDGE_ZONE_PX = 28;
const VELOCITY_THRESHOLD = 0.35;
const OPEN_RATIO = 0.35;
const MD_BREAKPOINT = 768;

function isMobileViewport() {
  return typeof window !== "undefined" && window.innerWidth < MD_BREAKPOINT;
}

export function useSlideOutSidebar(sidebarWidth = 256) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [translateX, setTranslateX] = useState(-sidebarWidth);
  const [isDragging, setIsDragging] = useState(false);
  const translateXRef = useRef(translateX);
  const touchRef = useRef<{
    startX: number;
    startY: number;
    startTime: number;
    startTranslate: number;
    mode: "open" | "close";
    locked: boolean | null;
  } | null>(null);

  translateXRef.current = translateX;

  const open = useCallback(() => setMobileOpen(true), []);
  const close = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!isDragging) {
      setTranslateX(mobileOpen ? 0 : -sidebarWidth);
    }
  }, [mobileOpen, isDragging, sidebarWidth]);

  const beginTouch = useCallback((clientX: number, clientY: number, mode: "open" | "close") => {
    if (!isMobileViewport() || touchRef.current) return;
    touchRef.current = {
      startX: clientX,
      startY: clientY,
      startTime: Date.now(),
      startTranslate: translateXRef.current,
      mode,
      locked: null,
    };
    setIsDragging(true);
  }, []);

  const onEdgeTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobileViewport() || translateXRef.current >= -1) return;
      beginTouch(e.touches[0].clientX, e.touches[0].clientY, "open");
    },
    [beginTouch]
  );

  const onSidebarTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobileViewport()) return;
      if (translateXRef.current <= -sidebarWidth + 1) return;
      beginTouch(e.touches[0].clientX, e.touches[0].clientY, "close");
    },
    [beginTouch, sidebarWidth]
  );

  useEffect(() => {
    function handleTouchMove(e: TouchEvent) {
      const state = touchRef.current;
      if (!state) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - state.startX;
      const deltaY = touch.clientY - state.startY;

      if (state.locked === null) {
        if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return;

        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          touchRef.current = null;
          setIsDragging(false);
          setTranslateX(mobileOpen ? 0 : -sidebarWidth);
          return;
        }

        state.locked = true;
      }

      if (!state.locked) return;

      e.preventDefault();

      setTranslateX(
        Math.max(-sidebarWidth, Math.min(0, state.startTranslate + deltaX))
      );
    }

    function handleTouchEnd(e: TouchEvent) {
      const state = touchRef.current;
      if (!state) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - state.startX;
      const elapsed = Date.now() - state.startTime;
      const velocity = deltaX / Math.max(elapsed, 1);
      const currentX = translateXRef.current;

      let shouldOpen: boolean;

      if (state.mode === "open") {
        shouldOpen =
          currentX > -sidebarWidth * (1 - OPEN_RATIO) || velocity > VELOCITY_THRESHOLD;
      } else {
        shouldOpen = !(currentX < -sidebarWidth * OPEN_RATIO || velocity < -VELOCITY_THRESHOLD);
      }

      setMobileOpen(shouldOpen);
      setIsDragging(false);
      touchRef.current = null;
    }

    if (isDragging) {
      document.addEventListener("touchmove", handleTouchMove, { passive: false });
      document.addEventListener("touchend", handleTouchEnd);
      document.addEventListener("touchcancel", handleTouchEnd);
    }

    return () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      document.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [isDragging, mobileOpen, sidebarWidth]);

  const progress = Math.max(0, Math.min(1, (translateX + sidebarWidth) / sidebarWidth));

  const tryOpenFromEdge = useCallback(
    (clientX: number, clientY: number) => {
      if (!isMobileViewport() || translateXRef.current >= -1) return;
      if (clientX > EDGE_ZONE_PX) return;
      beginTouch(clientX, clientY, "open");
    },
    [beginTouch]
  );

  return {
    mobileOpen,
    translateX,
    isDragging,
    progress,
    open,
    close,
    onEdgeTouchStart,
    onSidebarTouchStart,
    tryOpenFromEdge,
    sidebarWidth,
  };
}

export function useIsMobile(breakpoint = MD_BREAKPOINT) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);

  return isMobile;
}
export function getMobileSidebarStyle(
  translateX: number,
  isDragging: boolean,
  sidebarWidth: number
): CSSProperties {
  return {
    transform: `translateX(${translateX}px)`,
    transition: isDragging ? "none" : "transform 300ms cubic-bezier(0.32, 0.72, 0, 1)",
    width: sidebarWidth,
  };
}
