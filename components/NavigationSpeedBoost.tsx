"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
const ROUTE_LOADING_MAX_MS = 8000;

const personalCriticalRoutes = [
  "/dashboard/overview",
  "/dashboard/transactions",
  "/dashboard/budget",
  "/dashboard/bills",
  "/dashboard/settings",
  "/dashboard/profile",
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

  useEffect(() => {
    const contextKey = `${workspace}:${cacheKey}`;
    const existing = warmedByContext.get(contextKey) ?? new Set<string>();
    warmedByContext.set(contextKey, existing);
    warmedRoutes.current = existing;
  }, [cacheKey, workspace]);

  useEffect(() => {
    const root = document.documentElement;
    root.removeAttribute("data-ficonter-route-loading");

    if (loadingDelayTimer.current) {
      window.clearTimeout(loadingDelayTimer.current);
      loadingDelayTimer.current = null;
    }
    if (loadingMaxTimer.current) {
      window.clearTimeout(loadingMaxTimer.current);
      loadingMaxTimer.current = null;
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
      if (!route || route === routeKey || warmedRoutes.current.has(route)) return;
      warmedRoutes.current.add(route);
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
      if (!route || route === routeKey) return;

      warmRoute(route);

      // Do not flash a progress bar for genuinely instant client-side routes.
      // It appears only when navigation takes long enough to be perceptible.
      if (loadingDelayTimer.current) window.clearTimeout(loadingDelayTimer.current);
      if (loadingMaxTimer.current) window.clearTimeout(loadingMaxTimer.current);

      loadingDelayTimer.current = window.setTimeout(() => {
        document.documentElement.dataset.ficonterRouteLoading = "true";
        loadingDelayTimer.current = null;
      }, ROUTE_LOADING_DELAY_MS);

      loadingMaxTimer.current = window.setTimeout(() => {
        document.documentElement.removeAttribute("data-ficonter-route-loading");
        loadingMaxTimer.current = null;
      }, ROUTE_LOADING_MAX_MS);
    }

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

      if (loadingDelayTimer.current) window.clearTimeout(loadingDelayTimer.current);
      if (loadingMaxTimer.current) window.clearTimeout(loadingMaxTimer.current);
      loadingDelayTimer.current = null;
      loadingMaxTimer.current = null;
      document.documentElement.removeAttribute("data-ficonter-route-loading");

      if (transitionTimer.current) {
        window.clearTimeout(transitionTimer.current);
        transitionTimer.current = null;
      }
    };
  }, [routeKey, router]);

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
      warmedRoutes.current.add(route);
      try {
        router.prefetch(route);
      } catch {
        warmedRoutes.current.delete(route);
      }
    }

    // Warm the routes users are most likely to choose immediately after the
    // shell becomes interactive. Staggering prevents a burst of RSC requests.
    criticalRoutes.forEach((route, index) => {
      scheduled.push(window.setTimeout(() => warm(route), 40 + index * 70));
    });

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
