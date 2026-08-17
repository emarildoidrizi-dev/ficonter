"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FICONTER_NAVIGATION_INTENT_EVENT,
  FICONTER_NAVIGATION_SETTLED_EVENT,
  FICONTER_NAVIGATION_STALLED_EVENT,
  clearFiconterNavigationState,
  requestFiconterNavigationIntent,
  type FiconterNavigationIntentDetail,
} from "@/lib/navigationRuntime";

type Workspace = "personal" | "business";

type NetworkInformation = {
  effectiveType?: string;
  saveData?: boolean;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformation;
};

type IdleWindow = Window & {
  requestIdleCallback?: (
    callback: () => void,
    options?: { timeout?: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const ROUTE_LOADING_DELAY_MS = 140;
const ROUTE_LOADING_MAX_MS = 12_000;
const ROUTE_CLIENT_RETRY_MS = 4_000;
const ROUTE_HARD_RECOVERY_MS = 8_000;
const MAX_WARMED_CONTEXTS = 12;
const MAX_WARMED_ROUTES_PER_CONTEXT = 40;

const personalCriticalRoutes = [
  "/dashboard/overview",
  "/dashboard/transactions",
  "/dashboard/budget",
  "/dashboard/bills",
  "/dashboard/settings",
];

const personalSecondaryRoutes = [
  "/dashboard/savings",
  "/dashboard/debt",
  "/dashboard/credit-cards",
  "/dashboard/goals",
  "/dashboard/net-worth",
  "/dashboard/cash-flow",
  "/dashboard/emergency-fund",
  "/dashboard/gps",
  "/dashboard/financial-independence",
  "/dashboard/insights",
  "/dashboard/documents",
  "/dashboard/inbox",
  "/dashboard/setup",
];

const businessCriticalRoutes = [
  "/business/overview",
  "/business/sales",
  "/business/transactions",
  "/business/reports",
  "/business/inventory",
];

const businessSecondaryRoutes = [
  "/business/cost-control",
  "/business/suppliers",
  "/business/administration",
  "/business/manage",
  "/business/setup",
];

const warmedByContext = new Map<string, Set<string>>();

function internalRoute(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;

  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor) return null;
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;

  const href = anchor.getAttribute("href");
  if (!href || href.startsWith("#")) return null;

  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function shouldHandleClick(event: MouseEvent) {
  return (
    event.button === 0 &&
    !event.defaultPrevented &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function allowsBackgroundPrefetch() {
  const connection = (navigator as NavigatorWithConnection).connection;
  if (connection?.saveData) return false;
  return !["slow-2g", "2g"].includes(connection?.effectiveType ?? "");
}

function trimWarmCache() {
  while (warmedByContext.size > MAX_WARMED_CONTEXTS) {
    const oldest = warmedByContext.keys().next().value as string | undefined;
    if (!oldest) break;
    warmedByContext.delete(oldest);
  }
}

function rememberWarmedRoute(set: Set<string>, route: string) {
  set.add(route);
  while (set.size > MAX_WARMED_ROUTES_PER_CONTEXT) {
    const oldest = set.values().next().value as string | undefined;
    if (!oldest) break;
    set.delete(oldest);
  }
}


function navigationTargetSettled(routeKey: string, target: string) {
  if (routeKey === target) return true;

  const routePath = routeKey.split("?")[0] || routeKey;
  const targetPath = target.split("?")[0] || target;

  // Workspace roots are server redirects by design. Treat their canonical
  // landing screens as a successful navigation commit.
  if (targetPath === "/dashboard" && routePath === "/dashboard/overview") return true;
  if (
    targetPath === "/business" &&
    ["/business/overview", "/business/manage", "/business/setup"].includes(routePath)
  ) {
    return true;
  }

  return false;
}

function isNativePhoneApp() {
  const root = document.documentElement;
  return (
    root.dataset.ficonterNativeApp === "true" &&
    root.dataset.ficonterDevice === "phone"
  );
}

export function NavigationSpeedBoost({
  workspace,
  cacheKey,
}: {
  workspace: Workspace;
  cacheKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
  const warmedRoutes = useRef(new Set<string>());
  const previousRouteKey = useRef(routeKey);
  const lastAnimatedRouteKey = useRef(routeKey);
  const transitionTimer = useRef<number | null>(null);
  const loadingDelayTimer = useRef<number | null>(null);
  const loadingMaxTimer = useRef<number | null>(null);
  const retryTimer = useRef<number | null>(null);
  const recoveryTimer = useRef<number | null>(null);
  const currentRouteKey = useRef(routeKey);
  const pendingTarget = useRef<string | null>(null);
  const pendingOrigin = useRef<string | null>(null);
  const intentStartedAt = useRef(0);

  useEffect(() => {
    const contextKey = `${workspace}:${cacheKey}`;
    const existing = warmedByContext.get(contextKey) ?? new Set<string>();
    warmedByContext.set(contextKey, existing);
    trimWarmCache();
    warmedRoutes.current = existing;
  }, [cacheKey, workspace]);

  useEffect(() => {
    const root = document.documentElement;
    currentRouteKey.current = routeKey;
    root.removeAttribute("data-ficonter-route-loading");

    if (loadingDelayTimer.current) {
      window.clearTimeout(loadingDelayTimer.current);
      loadingDelayTimer.current = null;
    }
    if (loadingMaxTimer.current) {
      window.clearTimeout(loadingMaxTimer.current);
      loadingMaxTimer.current = null;
    }

    const target = pendingTarget.current;
    const navigationSettled = Boolean(
      target && navigationTargetSettled(routeKey, target),
    );

    if (navigationSettled) {
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      if (recoveryTimer.current) window.clearTimeout(recoveryTimer.current);
      retryTimer.current = null;
      recoveryTimer.current = null;
      const settledIntentStartedAt = intentStartedAt.current;
      pendingTarget.current = null;
      pendingOrigin.current = null;
      intentStartedAt.current = 0;
      clearFiconterNavigationState();
      // Keep the legacy marker explicit for release verification and older
      // embedded shells; the shared helper above already clears it too.
      root.removeAttribute("data-ficonter-route-pending");
      window.dispatchEvent(
        new CustomEvent(FICONTER_NAVIGATION_SETTLED_EVENT, {
          detail: { target, route: routeKey, startedAt: settledIntentStartedAt },
        }),
      );
    }

    const previous = previousRouteKey.current;
    const shouldAnimate =
      previous !== routeKey &&
      lastAnimatedRouteKey.current !== routeKey &&
      isNativePhoneApp();

    if (shouldAnimate) {
      const storageKey = "ficonter:mobile-route-stack";
      let stack: string[] = [];

      try {
        const parsed = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
        if (Array.isArray(parsed)) {
          stack = parsed.filter((item): item is string => typeof item === "string");
        }
      } catch {
        stack = [];
      }

      if (!stack.length) stack = [previous];

      let direction: "forward" | "back" = "forward";
      const previousIndex = stack.lastIndexOf(routeKey);

      if (stack.length >= 2 && stack[stack.length - 2] === routeKey) {
        direction = "back";
        stack.pop();
      } else if (previousIndex >= 0 && previousIndex < stack.length - 1) {
        direction = "back";
        stack = stack.slice(0, previousIndex + 1);
      } else if (stack[stack.length - 1] !== routeKey) {
        stack.push(routeKey);
      }

      try {
        sessionStorage.setItem(storageKey, JSON.stringify(stack.slice(-40)));
      } catch {
        // Session storage is only a progressive enhancement for navigation direction.
      }

      lastAnimatedRouteKey.current = routeKey;
      root.dataset.ficonterNavDirection = direction;
      root.dataset.ficonterNavTransition = "active";

      if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
      transitionTimer.current = window.setTimeout(() => {
        root.removeAttribute("data-ficonter-nav-transition");
        transitionTimer.current = null;
      }, direction === "back" ? 200 : 220);
    }

    previousRouteKey.current = routeKey;
  }, [routeKey]);

  useEffect(() => {
    function warmRoute(route: string | null) {
      if (!route || route === currentRouteKey.current || warmedRoutes.current.has(route)) return;
      rememberWarmedRoute(warmedRoutes.current, route);
      try {
        router.prefetch(route);
      } catch {
        warmedRoutes.current.delete(route);
      }
    }

    function warmTarget(target: EventTarget | null) {
      warmRoute(internalRoute(target));
    }

    function handlePointerOver(event: PointerEvent) {
      warmTarget(event.target);
    }

    function handlePointerDown(event: PointerEvent) {
      warmTarget(event.target);
    }

    function handleFocusIn(event: FocusEvent) {
      warmTarget(event.target);
    }

    function handleTouchStart(event: TouchEvent) {
      warmTarget(event.target);
    }

    function handleClick(event: MouseEvent) {
      if (!shouldHandleClick(event)) return;
      const route = internalRoute(event.target);
      const origin = currentRouteKey.current;
      if (!route || route === origin) return;

      warmRoute(route);

      if (!requestFiconterNavigationIntent(route, origin)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function handleNavigationIntent(event: Event) {
      const detail = (event as CustomEvent<FiconterNavigationIntentDetail>).detail;
      if (!detail?.target || !detail?.origin) return;

      const route = detail.target;
      pendingTarget.current = route;
      pendingOrigin.current = detail.origin;
      intentStartedAt.current = detail.startedAt || Date.now();

      if (loadingDelayTimer.current) window.clearTimeout(loadingDelayTimer.current);
      if (loadingMaxTimer.current) window.clearTimeout(loadingMaxTimer.current);
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      if (recoveryTimer.current) window.clearTimeout(recoveryTimer.current);

      loadingDelayTimer.current = window.setTimeout(() => {
        if (pendingTarget.current === route) {
          document.documentElement.dataset.ficonterRouteLoading = "true";
        }
        loadingDelayTimer.current = null;
      }, ROUTE_LOADING_DELAY_MS);

      loadingMaxTimer.current = window.setTimeout(() => {
        document.documentElement.removeAttribute("data-ficonter-route-loading");
        loadingMaxTimer.current = null;
      }, ROUTE_LOADING_MAX_MS);

      // A healthy prefetched transition will finish long before this retry.
      retryTimer.current = window.setTimeout(() => {
        if (
          pendingTarget.current === route &&
          currentRouteKey.current === pendingOrigin.current
        ) {
          router.replace(route, { scroll: false });
        }
        retryTimer.current = null;
      }, ROUTE_CLIENT_RETRY_MS);

      // Last-resort recovery. This is intentionally outside the normal path:
      // it only runs if the App Router has remained stuck for eleven seconds.
      recoveryTimer.current = window.setTimeout(() => {
        if (
          pendingTarget.current === route &&
          currentRouteKey.current === pendingOrigin.current
        ) {
          window.dispatchEvent(
            new CustomEvent(FICONTER_NAVIGATION_STALLED_EVENT, {
              detail: { target: route, route: currentRouteKey.current },
            }),
          );
          clearFiconterNavigationState();
          window.location.assign(route);
        }
        recoveryTimer.current = null;
      }, ROUTE_HARD_RECOVERY_MS);
    }

    window.addEventListener(FICONTER_NAVIGATION_INTENT_EVENT, handleNavigationIntent);
    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("touchstart", handleTouchStart, {
      capture: true,
      passive: true,
    });
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("pointerover", handlePointerOver, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener("touchstart", handleTouchStart, true);
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener(FICONTER_NAVIGATION_INTENT_EVENT, handleNavigationIntent);

      if (loadingDelayTimer.current) window.clearTimeout(loadingDelayTimer.current);
      if (loadingMaxTimer.current) window.clearTimeout(loadingMaxTimer.current);
      if (retryTimer.current) window.clearTimeout(retryTimer.current);
      if (recoveryTimer.current) window.clearTimeout(recoveryTimer.current);
      loadingDelayTimer.current = null;
      loadingMaxTimer.current = null;
      retryTimer.current = null;
      recoveryTimer.current = null;
      clearFiconterNavigationState();

      if (transitionTimer.current) {
        window.clearTimeout(transitionTimer.current);
        transitionTimer.current = null;
      }
    };
  }, [router]);

  useEffect(() => {
    const criticalRoutes =
      workspace === "personal" ? personalCriticalRoutes : businessCriticalRoutes;
    const secondaryRoutes =
      workspace === "personal" ? personalSecondaryRoutes : businessSecondaryRoutes;
    const oppositeWorkspace = workspace === "personal" ? "/business/overview" : "/dashboard/overview";
    const contextKey = `${workspace}:${cacheKey}`;
    const idleWindow = window as IdleWindow;
    const scheduled: number[] = [];
    let idleHandle: number | null = null;

    function warm(route: string) {
      if (route === pathname || warmedRoutes.current.has(route)) return;
      rememberWarmedRoute(warmedRoutes.current, route);
      try {
        router.prefetch(route);
      } catch {
        warmedRoutes.current.delete(route);
      }
    }

    // Warm likely destinations only when the network can afford background
    // work. On Save-Data/2G links, pointer/touch intent still prefetches the
    // exact route, but FICONTER avoids saturating the connection at startup.
    if (allowsBackgroundPrefetch() && document.visibilityState === "visible") {
      criticalRoutes.forEach((route, index) => {
        scheduled.push(window.setTimeout(() => warm(route), 60 + index * 90));
      });
    }

    const warmSecondary = () => {
      if (!allowsBackgroundPrefetch() || document.visibilityState !== "visible") return;
      secondaryRoutes.forEach((route, index) => {
        scheduled.push(window.setTimeout(() => warm(route), index * 85));
      });
      scheduled.push(window.setTimeout(() => warm(oppositeWorkspace), 180));
    };

    if (idleWindow.requestIdleCallback) {
      idleHandle = idleWindow.requestIdleCallback(warmSecondary, { timeout: 900 });
    } else {
      scheduled.push(window.setTimeout(warmSecondary, 650));
    }

    return () => {
      scheduled.forEach((timer) => window.clearTimeout(timer));
      if (idleHandle !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
      }
      // The warmed set intentionally survives same-workspace navigation.
      warmedByContext.set(contextKey, warmedRoutes.current);
    };
  }, [cacheKey, pathname, router, workspace]);

  return null;
}
