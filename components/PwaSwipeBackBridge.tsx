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

function isInstalledPhonePwa() {
  if (typeof window === "undefined") return false;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as IOSNavigator).standalone);

  if (!standalone) return false;

  const width = Math.max(
    1,
    Math.round(
      window.visualViewport?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth,
    ),
  );
  const shortestPhysicalSide = Math.min(
    window.screen.width || width,
    window.screen.height || width,
  );
  const touchCapable =
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches;

  return width <= 640 || (touchCapable && shortestPhysicalSide <= 640);
}

function isAppRoute(pathname: string) {
  return pathname.startsWith("/dashboard") || pathname.startsWith("/business");
}

function findVisibleBackButton() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>('button[aria-label="Go back"]'),
  ).find((button) => {
    if (button.disabled) return false;
    const style = window.getComputedStyle(button);
    return style.display !== "none" && style.visibility !== "hidden";
  });
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
 * Owns the installed-phone PWA's left-edge Back gesture before WebKit can
 * expose the browser-history snapshot underneath the current screen.
 *
 * The gesture does not mutate history itself. It delegates to FICONTER's
 * existing visible Back button, so page-specific interception (Settings,
 * dialogs, nested flows) remains the single navigation authority.
 */
export function PwaSwipeBackBridge() {
  const pathname = usePathname();
  const sessionRef = useRef<SwipeSession>(emptySession());

  useEffect(() => {
    if (!isInstalledPhonePwa() || !isAppRoute(pathname)) {
      sessionRef.current = emptySession();
      return;
    }

    const reset = () => {
      sessionRef.current = emptySession();
    };

    const handleTouchStart = (event: TouchEvent) => {
      reset();

      if (!isInstalledPhonePwa() || !isAppRoute(window.location.pathname)) return;
      if (event.touches.length !== 1) return;

      const touch = event.touches[0];
      if (touch.clientX > EDGE_START_PX) return;

      const backButton = findVisibleBackButton();
      if (!backButton) return;

      sessionRef.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        backButton,
      };

      // This has to happen on touchstart, not after popstate. Otherwise iOS
      // can paint the previous history entry for a frame during its native
      // interactive Back gesture before FICONTER gets control.
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
      const horizontalEnough =
        deltaX >= MIN_BACK_SWIPE_PX &&
        Math.abs(deltaY) <= MAX_VERTICAL_DRIFT_PX &&
        deltaX >= Math.abs(deltaY) * HORIZONTAL_DOMINANCE;
      const backButton = session.backButton;

      reset();
      if (event.cancelable) event.preventDefault();

      if (!horizontalEnough || !backButton?.isConnected) return;

      // Run after the touch sequence has fully settled. Programmatic click
      // reaches the exact same Settings/local Back interception and global
      // navigation stack as a physical tap on the header Back control.
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
