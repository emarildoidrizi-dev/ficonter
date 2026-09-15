"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

const HISTORY_GUARD_KEY = "__ficonterPwaBackGuard";

type IOSNavigator = Navigator & {
  standalone?: boolean;
};

type GuardState = {
  href: string;
  pathname: string;
};

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

function locationHref() {
  return `${window.location.pathname}${window.location.search}`;
}

function readGuardState(value: unknown): GuardState | null {
  if (!value || typeof value !== "object") return null;

  const guard = (value as Record<string, unknown>)[HISTORY_GUARD_KEY];
  if (!guard || typeof guard !== "object") return null;

  const href = (guard as Record<string, unknown>).href;
  const pathname = (guard as Record<string, unknown>).pathname;

  if (typeof href !== "string" || typeof pathname !== "string") return null;
  return { href, pathname };
}

function guardedHistoryState(href: string) {
  const current = window.history.state;
  const base = current && typeof current === "object" ? current : {};

  return {
    ...base,
    [HISTORY_GUARD_KEY]: {
      href,
      pathname: window.location.pathname,
    } satisfies GuardState,
  };
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

/**
 * Keeps the installed phone PWA's native edge-back gesture aligned with
 * FICONTER's in-app Back contract.
 *
 * iOS/browser history is not the visual-state authority. A same-page guard
 * absorbs the platform gesture first. Query-only/local-detail history steps
 * (for example Settings detail -> Settings menu) are allowed to resolve
 * naturally. Otherwise the gesture delegates to the same Go back button the
 * user would tap, so page-specific Back interception remains authoritative.
 */
export function PwaSwipeBackBridge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const armedRef = useRef(false);
  const guardedHrefRef = useRef("");

  const search = searchParams.toString();
  const routeHref = search ? `${pathname}?${search}` : pathname;

  useEffect(() => {
    if (!isInstalledPhonePwa() || !isAppRoute(pathname)) {
      armedRef.current = false;
      guardedHrefRef.current = "";
      return;
    }

    const armGuard = (href = locationHref()) => {
      if (!isInstalledPhonePwa() || !isAppRoute(window.location.pathname)) {
        armedRef.current = false;
        return;
      }

      const existingGuard = readGuardState(window.history.state);
      const nextState = guardedHistoryState(href);

      // A query/local-detail update can replace the current URL while keeping
      // the same route entry. Keep that guard in place and only refresh its
      // metadata. A different pathname needs its own duplicate entry so a
      // native edge swipe cannot jump directly to the previous app route.
      if (existingGuard?.pathname === window.location.pathname) {
        window.history.replaceState(nextState, "", window.location.href);
      } else {
        window.history.pushState(nextState, "", window.location.href);
      }

      guardedHrefRef.current = href;
      armedRef.current = true;
    };

    guardedHrefRef.current = routeHref;
    armGuard(routeHref);

    const handleNativeBack = () => {
      if (!armedRef.current || !isInstalledPhonePwa()) return;

      const guardedHref = guardedHrefRef.current;
      const destinationHref = locationHref();
      armedRef.current = false;

      // Immediately protect the destination again. pushState does not emit a
      // popstate event, so this cannot recurse.
      armGuard(destinationHref);

      // If browser history already exposed a meaningful parent state on the
      // same app page (e.g. ?section=appearance -> Settings menu), do not take
      // a second Back step. The page's own popstate/state synchronization owns
      // that transition.
      if (destinationHref !== guardedHref) return;

      // A pure guard pop leaves the URL unchanged. Delegate to the same Back
      // control used by the PWA header so local page handlers (Settings,
      // dialogs, nested flows) get first refusal before route navigation.
      queueMicrotask(() => {
        findVisibleBackButton()?.click();
      });
    };

    window.addEventListener("popstate", handleNativeBack);
    return () => {
      window.removeEventListener("popstate", handleNativeBack);
    };
  }, [pathname, routeHref]);

  return null;
}
