"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

type SwipeSession = {
  active: boolean;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  backButton: HTMLButtonElement | null;
};

const EDGE_START_PX = 30;
const MIN_BACK_SWIPE_PX = 64;
const MAX_VERTICAL_DRIFT_PX = 80;
const HORIZONTAL_DOMINANCE = 1.12;

function isInstalledTouchApp() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const standalone =
    document.documentElement.dataset.ficonterDisplayMode === "standalone" ||
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as IOSNavigator).standalone);

  if (!standalone) return false;

  const touchCapable =
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches;

  if (!touchCapable) return false;

  const width = Math.max(
    1,
    Math.round(
      window.visualViewport?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth,
    ),
  );

  return (
    document.documentElement.dataset.ficonterNativeApp === "true" ||
    width <= 1180
  );
}

function isFiconterAppRoute(pathname: string) {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/business");
}

function findVisibleBackButton() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[aria-label="Go back"]'),
  ).find((button) => {
    if (button.disabled) return false;
    const style = window.getComputedStyle(button);
    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.pointerEvents !== "none"
    );
  }) ?? null;
}

function emptySession(): SwipeSession {
  return {
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    backButton: null,
  };
}

/**
 * Provides an app-only left-edge Back gesture for the installed FICONTER PWA.
 * It never mutates browser history directly. Instead, a completed swipe clicks
 * FICONTER's existing Back control so local hierarchies such as Settings detail
 * -> Settings menu continue to use the same navigation authority as a tap.
 */
export function AppSwipeBackBridge() {
  const pathname = usePathname();
  const sessionRef = useRef<SwipeSession>(emptySession());

  useEffect(() => {
    if (!isInstalledTouchApp() || !isFiconterAppRoute(pathname)) {
      sessionRef.current = emptySession();
      return;
    }

    const reset = () => {
      sessionRef.current = emptySession();
    };

    const handleTouchStart = (event: TouchEvent) => {
      reset();

      if (!isInstalledTouchApp()) return;
      if (!isFiconterAppRoute(window.location.pathname)) return;
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];
      if (touch.clientX > EDGE_START_PX) return;

      const root = document.documentElement;
      const sheetOpen =
        root.dataset.ficonterAppDrawer === "open" ||
        root.dataset.ficonterAccountMenu === "open";

      sessionRef.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        backButton: sheetOpen ? null : findVisibleBackButton(),
      };

      // Claim the edge gesture immediately so the installed app does not hand
      // control to WebKit/browser history before FICONTER can apply its own
      // page hierarchy.
      if (event.cancelable) event.preventDefault();
    };

    const handleTouchMove = (event: TouchEvent) => {
      const session = sessionRef.current;
      if (!session.active || event.touches.length !== 1) return;

      const touch = event.touches[0];
      session.lastX = touch.clientX;
      session.lastY = touch.clientY;

      if (event.cancelable) event.preventDefault();
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const session = sessionRef.current;
      if (!session.active) return;

      const touch = event.changedTouches[0];
      const endX = touch?.clientX ?? session.lastX;
      const endY = touch?.clientY ?? session.lastY;
      const deltaX = endX - session.startX;
      const deltaY = endY - session.startY;
      const completed =
        deltaX >= MIN_BACK_SWIPE_PX &&
        Math.abs(deltaY) <= MAX_VERTICAL_DRIFT_PX &&
        deltaX >= Math.abs(deltaY) * HORIZONTAL_DOMINANCE;
      const backButton = session.backButton;

      reset();
      if (event.cancelable) event.preventDefault();

      if (!completed || !backButton?.isConnected) return;

      queueMicrotask(() => backButton.click());
    };

    const handleTouchCancel = () => reset();
    const options: AddEventListenerOptions = {
      capture: true,
      passive: false,
    };

    document.addEventListener("touchstart", handleTouchStart, options);
    document.addEventListener("touchmove", handleTouchMove, options);
    document.addEventListener("touchend", handleTouchEnd, options);
    document.addEventListener("touchcancel", handleTouchCancel, options);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart, options);
      document.removeEventListener("touchmove", handleTouchMove, options);
      document.removeEventListener("touchend", handleTouchEnd, options);
      document.removeEventListener("touchcancel", handleTouchCancel, options);
    };
  }, [pathname]);

  return null;
}
