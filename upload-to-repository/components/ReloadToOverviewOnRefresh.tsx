"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const OVERVIEW_ROUTE = "/dashboard/overview";

/**
 * Personal dashboard refresh policy:
 * - Overview has its own permanent route: /dashboard/overview
 * - normal in-app navigation never gets redirected
 * - only the initial browser reload of a dashboard sub-route returns to Overview
 *
 * The one-shot guard is important because PerformanceNavigationTiming.type remains
 * "reload" for the lifetime of that document. Without the guard, a later sidebar
 * click could be mistaken for another reload.
 */
export function ReloadToOverviewOnRefresh() {
  const pathname = usePathname();
  const router = useRouter();
  const handledInitialNavigation = useRef(false);

  useEffect(() => {
    if (handledInitialNavigation.current) return;
    handledInitialNavigation.current = true;

    if (!pathname?.startsWith("/dashboard")) return;
    if (pathname === OVERVIEW_ROUTE || pathname === "/dashboard") return;

    const [navigation] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];

    if (navigation?.type === "reload") {
      router.replace(OVERVIEW_ROUTE);
    }
  }, [pathname, router]);

  return null;
}
