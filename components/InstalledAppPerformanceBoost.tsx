"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isInstalledStandaloneApp } from "@/lib/pwaRuntimeRecovery";

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

const CRITICAL_PREFETCH_START_MS = 0;
const CRITICAL_PREFETCH_STEP_MS = 28;
const SECONDARY_PREFETCH_STEP_MS = 42;
const SECONDARY_IDLE_TIMEOUT_MS = 420;
const SECONDARY_FALLBACK_MS = 180;
const PREFETCH_REFRESH_MS = 2 * 60 * 1000;
const MAX_CONTEXTS = 12;

const personalCriticalRoutes = [
  "/dashboard/overview",
  "/dashboard/transactions",
  "/dashboard/budget",
  "/dashboard/bills",
  "/dashboard/settings",
] as const;

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
] as const;

const businessCriticalRoutes = [
  "/business/overview",
  "/business/sales",
  "/business/transactions",
  "/business/reports",
  "/business/inventory",
] as const;

const businessSecondaryRoutes = [
  "/business/cost-control",
  "/business/suppliers",
  "/business/administration",
  "/business/manage",
  "/business/setup",
] as const;

const warmedAtByContext = new Map<string, Map<string, number>>();

function allowsAggressivePrefetch() {
  const connection = (navigator as NavigatorWithConnection).connection;
  if (connection?.saveData) return false;
  return !["slow-2g", "2g"].includes(connection?.effectiveType ?? "");
}

function getWarmState(contextKey: string) {
  const existing = warmedAtByContext.get(contextKey);
  if (existing) return existing;

  const created = new Map<string, number>();
  warmedAtByContext.set(contextKey, created);

  while (warmedAtByContext.size > MAX_CONTEXTS) {
    const oldest = warmedAtByContext.keys().next().value as string | undefined;
    if (!oldest) break;
    warmedAtByContext.delete(oldest);
  }

  return created;
}

export function InstalledAppPerformanceBoost({
  workspace,
  cacheKey,
}: {
  workspace: Workspace;
  cacheKey: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isInstalledStandaloneApp()) return;

    const idleWindow = window as IdleWindow;
    const timers = new Set<number>();
    const contextKey = `${workspace}:${cacheKey}`;
    const warmedAt = getWarmState(contextKey);
    const criticalRoutes =
      workspace === "personal" ? personalCriticalRoutes : businessCriticalRoutes;
    const secondaryRoutes =
      workspace === "personal" ? personalSecondaryRoutes : businessSecondaryRoutes;
    let idleHandle: number | null = null;
    let disposed = false;

    function schedule(callback: () => void, delay: number) {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        if (!disposed) callback();
      }, delay);
      timers.add(timer);
    }

    function warm(route: string, forceFresh = false) {
      if (disposed || route === pathname || !allowsAggressivePrefetch()) return;

      const lastWarmedAt = warmedAt.get(route) ?? 0;
      if (!forceFresh && Date.now() - lastWarmedAt < PREFETCH_REFRESH_MS) return;

      warmedAt.set(route, Date.now());
      try {
        router.prefetch(route);
      } catch {
        warmedAt.delete(route);
      }
    }

    function warmCritical(forceFresh = false) {
      if (document.visibilityState !== "visible" || !allowsAggressivePrefetch()) return;
      criticalRoutes.forEach((route, index) => {
        schedule(
          () => warm(route, forceFresh),
          CRITICAL_PREFETCH_START_MS + index * CRITICAL_PREFETCH_STEP_MS,
        );
      });
    }

    function warmSecondary() {
      if (document.visibilityState !== "visible" || !allowsAggressivePrefetch()) return;
      secondaryRoutes.forEach((route, index) => {
        schedule(() => warm(route), index * SECONDARY_PREFETCH_STEP_MS);
      });
    }

    function scheduleSecondaryWarmup() {
      if (idleHandle !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
        idleHandle = null;
      }

      if (idleWindow.requestIdleCallback) {
        idleHandle = idleWindow.requestIdleCallback(() => {
          idleHandle = null;
          warmSecondary();
        }, { timeout: SECONDARY_IDLE_TIMEOUT_MS });
      } else {
        schedule(warmSecondary, SECONDARY_FALLBACK_MS);
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      // iOS can suspend a home-screen PWA for a long time. Re-warm the five
      // primary destinations after resume when the previous prefetch is stale.
      warmCritical(false);
      scheduleSecondaryWarmup();
    }

    warmCritical(false);
    scheduleSecondaryWarmup();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
      if (idleHandle !== null && idleWindow.cancelIdleCallback) {
        idleWindow.cancelIdleCallback(idleHandle);
      }
    };
  }, [cacheKey, pathname, router, workspace]);

  return null;
}
