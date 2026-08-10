"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * FICONTER dashboard refresh policy:
 * - normal in-app navigation keeps the user on the selected module
 * - a browser reload of a dashboard sub-route returns to Overview
 * - reloading Overview itself does nothing
 */
export function ReloadToOverviewOnRefresh() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!pathname || pathname === "/dashboard") return;
    if (!pathname.startsWith("/dashboard/")) return;

    const entries = performance.getEntriesByType("navigation");
    const navigation = entries[0] as PerformanceNavigationTiming | undefined;

    if (navigation?.type === "reload") {
      router.replace("/dashboard");
    }
  }, [pathname, router]);

  return null;
}
