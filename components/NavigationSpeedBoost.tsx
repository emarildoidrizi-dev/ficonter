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

const personalCriticalRoutes = [
  "/dashboard",
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
  const connection = (
    navigator as NavigatorWithConnection
  ).connection;

  if (connection?.saveData) return false;

  return !["slow-2g", "2g"].includes(
    connection?.effectiveType ?? "",
  );
}

function isNativePhoneApp() {
  return (
    document.documentElement.dataset.ficonterNativeApp ===
    "true"
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
  const transitionTimer = useRef<number | null>(null);
  const loadingTimer = useRef<number | null>(null);

  useEffect(() => {
    const contextKey = `${workspace}:${cacheKey}`;
    const existing =
      warmedByContext.get(contextKey) ?? new Set<string>();

    warmedByContext.set(contextKey, existing);
    warmedRoutes.current = existing;
  }, [cacheKey, workspace]);

  useEffect(() => {
    const root = document.documentElement;

    root.removeAttribute("data-ficonter-route-loading");

    if (loadingTimer.current) {
      window.clearTimeout(loadingTimer.current);
      loadingTimer.current = null;
    }

    const previous = previousRouteKey.current;
    if (previous !== routeKey && isNativePhoneApp()) {
      const storageKey = "ficonter:mobile-route-stack";
      let stack: string[] = [];

      try {
        const parsed = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
        if (Array.isArray(parsed)) stack = parsed.filter((item): item is string => typeof item === "string");
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

      root.dataset.ficonterNavDirection = direction;
      root.dataset.ficonterNavTransition = "active";

      if (transitionTimer.current) window.clearTimeout(transitionTimer.current);
      transitionTimer.current = window.setTimeout(() => {
        root.removeAttribute("data-ficonter-nav-transition");
        transitionTimer.current = null;
      }, direction === "back" ? 300 : 340);
    }

    previousRouteKey.current = routeKey;
  }, [cacheKey, routeKey, workspace]);

  useEffect(() => {
    function warmRoute(route: string | null) {
      if (!route || route === routeKey) return;
      if (warmedRoutes.current.has(route)) return;

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

      document.documentElement.dataset.ficonterRouteLoading =
        "true";

      if (loadingTimer.current) {
        window.clearTimeout(loadingTimer.current);
      }

      loadingTimer.current = window.setTimeout(() => {
        document.documentElement.removeAttribute(
          "data-ficonter-route-loading",
        );
        loadingTimer.current = null;
      }, 9000);
    }

    document.addEventListener(
      "pointerover",
      handlePointerOver,
      true,
    );
    document.addEventListener(
      "pointerdown",
      handlePointerDown,
      true,
    );
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("touchstart", handleTouchStart, {
      capture: true,
      passive: true,
    });
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener(
        "pointerover",
        handlePointerOver,
        true,
      );
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
        true,
      );
      document.removeEventListener(
        "focusin",
        handleFocusIn,
        true,
      );
      document.removeEventListener(
        "touchstart",
        handleTouchStart,
        true,
      );
      document.removeEventListener(
        "click",
        handleClick,
        true,
      );

      if (loadingTimer.current) {
        window.clearTimeout(loadingTimer.current);
        loadingTimer.current = null;
      }

      document.documentElement.removeAttribute(
        "data-ficonter-route-loading",
      );
      if (transitionTimer.current) {
        window.clearTimeout(transitionTimer.current);
        transitionTimer.current = null;
      }
    };
  }, [routeKey, router]);

  useEffect(() => {
    const criticalRoutes =
      workspace === "personal"
        ? personalCriticalRoutes
        : businessCriticalRoutes;

    const secondaryRoutes =
      workspace === "personal"
        ? personalSecondaryRoutes
        : businessSecondaryRoutes;

    const oppositeWorkspace =
      workspace === "personal"
        ? "/business/overview"
        : "/dashboard";

    const scheduled: number[] = [];

    function schedule(route: string, delay: number) {
      scheduled.push(
        window.setTimeout(() => {
          if (
            route === pathname ||
            warmedRoutes.current.has(route)
          ) {
            return;
          }

          warmedRoutes.current.add(route);

          try {
            router.prefetch(route);
          } catch {
            warmedRoutes.current.delete(route);
          }
        }, delay),
      );
    }

    criticalRoutes.forEach((route, index) => {
      schedule(route, 120 + index * 130);
    });

    schedule(oppositeWorkspace, 900);

    if (
      allowsBackgroundPrefetch() &&
      isNativePhoneApp()
    ) {
      secondaryRoutes.forEach((route, index) => {
        schedule(route, 1100 + index * 190);
      });
    }

    return () => {
      scheduled.forEach((timer) =>
        window.clearTimeout(timer),
      );
    };
  }, [cacheKey, pathname, router, workspace]);

  return null;
}
