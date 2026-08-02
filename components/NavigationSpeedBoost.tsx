"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

type Workspace = "personal" | "business";

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

function canWarmRoute(
  workspace: Workspace,
  pathname: string,
  route: string,
) {
  if (route === pathname) return false;

  if (
    workspace === "business" &&
    route.startsWith("/business/") &&
    route !== "/business"
  ) {
    return false;
  }

  return true;
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
  const warmedRoutes = useRef(new Set<string>());

  useEffect(() => {
    warmedRoutes.current.clear();
  }, [cacheKey]);

  useEffect(() => {
    function warmRoute(target: EventTarget | null) {
      const route = internalRoute(target);
      if (!route) return;
      if (!canWarmRoute(workspace, pathname, route)) return;
      if (warmedRoutes.current.has(route)) return;

      warmedRoutes.current.add(route);
      router.prefetch(route);
    }

    function handlePointerOver(event: PointerEvent) {
      warmRoute(event.target);
    }

    function handleFocusIn(event: FocusEvent) {
      warmRoute(event.target);
    }

    function handleTouchStart(event: TouchEvent) {
      warmRoute(event.target);
    }

    document.addEventListener("pointerover", handlePointerOver, true);
    document.addEventListener("focusin", handleFocusIn, true);
    document.addEventListener("touchstart", handleTouchStart, {
      capture: true,
      passive: true,
    });

    return () => {
      document.removeEventListener(
        "pointerover",
        handlePointerOver,
        true,
      );
      document.removeEventListener("focusin", handleFocusIn, true);
      document.removeEventListener(
        "touchstart",
        handleTouchStart,
        true,
      );
    };
  }, [pathname, router, workspace]);

  useEffect(() => {
    const currentRoot =
      workspace === "personal" ? "/dashboard" : "/business";
    const otherRoot =
      workspace === "personal" ? "/business" : "/dashboard";

    const timeoutId = window.setTimeout(() => {
      for (const route of [currentRoot, otherRoot]) {
        if (warmedRoutes.current.has(route)) continue;
        warmedRoutes.current.add(route);
        router.prefetch(route);
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [cacheKey, router, workspace]);

  return null;
}
