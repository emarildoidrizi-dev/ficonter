"use client";

import { useEffect } from "react";

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

type PendingTap = {
  pointerId: number;
  button: HTMLButtonElement;
  startX: number;
  startY: number;
  moved: boolean;
};

const SECTION_BUTTON_SELECTOR =
  'button[class*="SettingsWorkspace_sectionButton"]';
const TAP_MOVE_TOLERANCE_PX = 8;
const NATIVE_CLICK_SUPPRESSION_MS = 500;

function installedPhoneSettingsRuntime() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const root = document.documentElement;
  const rootResolved =
    root.dataset.ficonterNativeApp === "true" &&
    root.dataset.ficonterDevice === "phone" &&
    root.dataset.ficonterDisplayMode === "standalone";

  if (rootResolved) return true;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((navigator as IOSNavigator).standalone);
  const width = Math.max(
    1,
    Math.round(
      window.visualViewport?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth,
    ),
  );

  return standalone && width <= 640;
}

function settingsButtonFromTarget(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLButtonElement>(SECTION_BUTTON_SELECTOR)
    : null;
}

/**
 * Installed-phone Settings interaction contract.
 *
 * React remains the only owner of the selected Settings section. This helper
 * does not add/remove active classes or duplicate section state. It only moves
 * the existing button click to the first completed tap event (pointerup), then
 * suppresses the later synthetic/native click that iOS may emit for the same
 * tap. The existing SettingsWorkspace onClick therefore performs setActive,
 * opens the detail panel and updates native history in one React event turn.
 */
export function InstalledPwaSettingsInteractionLock() {
  useEffect(() => {
    let pendingTap: PendingTap | null = null;
    let dispatchingImmediateClick = false;
    let suppressedButton: HTMLButtonElement | null = null;
    let suppressUntil = 0;

    const resetTap = () => {
      pendingTap = null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!installedPhoneSettingsRuntime() || event.button !== 0) {
        resetTap();
        return;
      }

      const button = settingsButtonFromTarget(event.target);
      if (!button || button.disabled) {
        resetTap();
        return;
      }

      pendingTap = {
        pointerId: event.pointerId,
        button,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
      };
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!pendingTap || pendingTap.pointerId !== event.pointerId) return;

      if (
        Math.abs(event.clientX - pendingTap.startX) > TAP_MOVE_TOLERANCE_PX ||
        Math.abs(event.clientY - pendingTap.startY) > TAP_MOVE_TOLERANCE_PX
      ) {
        pendingTap.moved = true;
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const tap = pendingTap;
      resetTap();

      if (
        !tap ||
        tap.pointerId !== event.pointerId ||
        tap.moved ||
        !installedPhoneSettingsRuntime() ||
        tap.button.disabled
      ) {
        return;
      }

      const releasedButton = settingsButtonFromTarget(event.target);
      if (releasedButton !== tap.button) return;

      // Complete the tap now instead of waiting for WebKit's subsequent click.
      // React's existing onClick remains the sole Settings state transition.
      event.preventDefault();
      event.stopPropagation();

      suppressedButton = tap.button;
      suppressUntil = performance.now() + NATIVE_CLICK_SUPPRESSION_MS;
      dispatchingImmediateClick = true;
      tap.button.click();
      dispatchingImmediateClick = false;
    };

    const handleClick = (event: MouseEvent) => {
      if (dispatchingImmediateClick || !suppressedButton) return;

      const button = settingsButtonFromTarget(event.target);
      if (
        button === suppressedButton &&
        performance.now() <= suppressUntil
      ) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        suppressedButton = null;
        suppressUntil = 0;
        return;
      }

      if (performance.now() > suppressUntil) {
        suppressedButton = null;
        suppressUntil = 0;
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", handlePointerUp, true);
    document.addEventListener("pointercancel", resetTap, true);
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("pointercancel", resetTap, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  return null;
}
