"use client";

import { useEffect } from "react";

type PendingTap = {
  pointerId: number;
  button: HTMLButtonElement;
  startX: number;
  startY: number;
  moved: boolean;
};

const SECTION_BUTTON_SELECTOR =
  'button[class*="SettingsWorkspace_sectionButton"]';
const SETTINGS_WORKSPACE_SELECTOR =
  '[class*="SettingsWorkspace_workspace"][data-mobile-detail]';
const BACK_BUTTON_SELECTOR = 'button[aria-label="Go back"]';
const TAP_MOVE_TOLERANCE_PX = 8;
const NATIVE_CLICK_SUPPRESSION_MS = 500;
const STYLE_ID = "ficonter-installed-settings-immediate-state";

function installedPhoneSettingsRuntime() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const root = document.documentElement;
  const rootResolved =
    root.dataset.ficonterNativeApp === "true" &&
    root.dataset.ficonterDevice === "phone";

  if (rootResolved) return true;

  const width = Math.max(
    1,
    Math.round(
      window.visualViewport?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth,
    ),
  );

  // FiconterNativeAppChrome resolves these root attributes in an effect. The
  // Settings workspace can mount one render earlier, so the physical viewport
  // is the deterministic fallback for the initial phone render. This also makes
  // the branch testable from the mobile browser preview while keeping tablet
  // and desktop behavior untouched.
  return width <= 640;
}

function settingsButtonFromTarget(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLButtonElement>(SECTION_BUTTON_SELECTOR)
    : null;
}

function backButtonFromTarget(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLButtonElement>(BACK_BUTTON_SELECTOR)
    : null;
}

function clearManagedContrast(scope: Element) {
  const elements = [
    scope,
    ...Array.from(scope.querySelectorAll<HTMLElement>("*")),
  ];

  for (const element of elements) {
    if (!(element instanceof HTMLElement)) continue;
    element.classList.remove("ficonter-auto-contrast");
    element.style.removeProperty("--ficonter-auto-text");
  }
}

function isolateSettingsRowsFromContrastGuard() {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    SECTION_BUTTON_SELECTOR,
  );

  for (const button of buttons) {
    // Settings owns these row foregrounds with deterministic authored CSS.
    // The global ThemeContrastGuard intentionally waits before re-auditing a
    // changed active row, which can visually repaint a stale selection. Keep
    // the Settings navigation outside that runtime correction path entirely.
    button.dataset.ficonterContrastIgnore = "true";
    clearManagedContrast(button);
  }
}

function projectSettingsParentImmediately() {
  const workspace = document.querySelector<HTMLElement>(
    SETTINGS_WORKSPACE_SELECTOR,
  );
  if (workspace) workspace.dataset.mobileDetail = "false";

  const page = document.querySelector<HTMLElement>(
    ".ficonter-settings-page",
  );
  if (page) page.dataset.settingsDetail = "false";

  isolateSettingsRowsFromContrastGuard();
  document.documentElement.removeAttribute("data-ficonter-route-loading");
}

function markSettingsDetailOpen() {
  const page = document.querySelector<HTMLElement>(
    ".ficonter-settings-page",
  );
  if (page) page.dataset.settingsDetail = "true";
}

/**
 * Phone Settings interaction contract.
 *
 * SettingsWorkspace remains the only owner of the selected section. This layer
 * removes browser/WebKit timing from the interaction and isolates Settings row
 * rendering from the global contrast observer. A completed tap dispatches the
 * existing React click immediately, while Back reveals the already-mounted
 * Settings parent before history/search-param reconciliation can repaint it.
 */
export function InstalledPwaSettingsInteractionLock() {
  useEffect(() => {
    if (!installedPhoneSettingsRuntime()) return;

    let pendingTap: PendingTap | null = null;
    let dispatchingImmediateClick = false;
    let suppressedButton: HTMLButtonElement | null = null;
    let suppressUntil = 0;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
html[data-ficonter-native-app="true"][data-ficonter-device="phone"]
  .ficonter-settings-page [class*="SettingsWorkspace_sectionButton"] {
  transition: none !important;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
html[data-ficonter-native-app="true"][data-ficonter-device="phone"]
  .ficonter-settings-page [class*="SettingsWorkspace_sectionButton"]:active {
  transform: none !important;
}`;

    document.getElementById(STYLE_ID)?.remove();
    document.head.appendChild(style);
    isolateSettingsRowsFromContrastGuard();

    const rowObserver = new MutationObserver((records) => {
      if (!installedPhoneSettingsRuntime()) return;

      for (const record of records) {
        if (record.type !== "childList" || !record.addedNodes.length) continue;
        isolateSettingsRowsFromContrastGuard();
        break;
      }
    });
    rowObserver.observe(document.body, { childList: true, subtree: true });

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

      isolateSettingsRowsFromContrastGuard();

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
      if (!installedPhoneSettingsRuntime()) {
        resetTap();
        return;
      }

      if (backButtonFromTarget(event.target)) {
        // The active row already belongs to the section being left. Reveal the
        // menu in this completed-tap frame and keep that selection untouched.
        projectSettingsParentImmediately();
        resetTap();
        return;
      }

      const tap = pendingTap;
      resetTap();

      if (
        !tap ||
        tap.pointerId !== event.pointerId ||
        tap.moved ||
        tap.button.disabled
      ) {
        return;
      }

      const releasedButton = settingsButtonFromTarget(event.target);
      if (releasedButton !== tap.button) return;

      event.preventDefault();
      event.stopPropagation();

      suppressedButton = tap.button;
      suppressUntil = performance.now() + NATIVE_CLICK_SUPPRESSION_MS;
      dispatchingImmediateClick = true;
      tap.button.click();
      dispatchingImmediateClick = false;
      clearManagedContrast(tap.button);
      markSettingsDetailOpen();
    };

    const handleClick = (event: MouseEvent) => {
      if (!installedPhoneSettingsRuntime()) return;

      const backButton = backButtonFromTarget(event.target);
      if (backButton) {
        const current = new URL(window.location.href);
        if (
          current.pathname === "/dashboard/settings" &&
          current.searchParams.has("section")
        ) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          projectSettingsParentImmediately();

          if (window.history.length > 1) {
            window.history.back();
            return;
          }

          current.searchParams.delete("section");
          const search = current.searchParams.toString();
          const next = `${current.pathname}${search ? `?${search}` : ""}${current.hash}`;
          window.history.replaceState(window.history.state, "", next);
        }
        return;
      }

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
      rowObserver.disconnect();
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerUp, true);
      document.removeEventListener("pointercancel", resetTap, true);
      document.removeEventListener("click", handleClick, true);
      style.remove();
    };
  }, []);

  return null;
}
