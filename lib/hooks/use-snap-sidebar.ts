"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const ADMIN_SIDEBAR_EXPANDED_WIDTH = 256;
export const ADMIN_SIDEBAR_COLLAPSED_WIDTH = 64;
export const ADMIN_SIDEBAR_SNAP_THRESHOLD = 50;
export const ADMIN_SIDEBAR_STORAGE_KEY = "hilaac-admin-sidebar-open";

type DragState = {
  startX: number;
  startWidth: number;
};

export function useSnapSidebar() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const widthRef = useRef(ADMIN_SIDEBAR_EXPANDED_WIDTH);

  const snappedWidth = isExpanded ? ADMIN_SIDEBAR_EXPANDED_WIDTH : ADMIN_SIDEBAR_COLLAPSED_WIDTH;
  const currentWidth = dragWidth ?? snappedWidth;
  widthRef.current = currentWidth;

  useEffect(() => {
    const stored = localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY);
    if (stored !== null) {
      setIsExpanded(stored === "true");
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, String(isExpanded));
  }, [isExpanded, hydrated]);

  const toggle = useCallback(() => {
    setIsExpanded((open) => !open);
    setDragWidth(null);
  }, []);

  const startDrag = useCallback(
    (clientX: number) => {
      dragRef.current = {
        startX: clientX,
        startWidth: widthRef.current,
      };
      setIsDragging(true);
    },
    []
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      startDrag(e.clientX);
    },
    [startDrag]
  );

  useEffect(() => {
    function handlePointerMove(e: PointerEvent) {
      const state = dragRef.current;
      if (!state) return;

      const deltaX = e.clientX - state.startX;
      const nextWidth = Math.max(
        ADMIN_SIDEBAR_COLLAPSED_WIDTH,
        Math.min(ADMIN_SIDEBAR_EXPANDED_WIDTH, state.startWidth + deltaX)
      );
      setDragWidth(nextWidth);
    }

    function finishDrag(e: PointerEvent) {
      const state = dragRef.current;
      if (!state) return;

      const deltaX = e.clientX - state.startX;
      const finalWidth = Math.max(
        ADMIN_SIDEBAR_COLLAPSED_WIDTH,
        Math.min(ADMIN_SIDEBAR_EXPANDED_WIDTH, state.startWidth + deltaX)
      );

      let nextExpanded = isExpanded;

      if (isExpanded) {
        if (deltaX <= -ADMIN_SIDEBAR_SNAP_THRESHOLD || finalWidth < (ADMIN_SIDEBAR_EXPANDED_WIDTH + ADMIN_SIDEBAR_COLLAPSED_WIDTH) / 2) {
          nextExpanded = false;
        }
      } else if (deltaX >= ADMIN_SIDEBAR_SNAP_THRESHOLD || finalWidth > (ADMIN_SIDEBAR_EXPANDED_WIDTH + ADMIN_SIDEBAR_COLLAPSED_WIDTH) / 2) {
        nextExpanded = true;
      }

      setIsExpanded(nextExpanded);
      setDragWidth(null);
      setIsDragging(false);
      dragRef.current = null;
    }

    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", finishDrag);
      window.addEventListener("pointercancel", finishDrag);
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [isDragging, isExpanded]);

  return {
    isExpanded,
    isCollapsed: !isExpanded,
    isDragging,
    currentWidth,
    toggle,
    onPointerDown,
    startDrag,
  };
}
