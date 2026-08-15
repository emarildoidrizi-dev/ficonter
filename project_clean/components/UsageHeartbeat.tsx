"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { UsageScope } from "@/lib/admin/usage-shared";

const HEARTBEAT_INTERVAL_MS = 60_000;
const IDLE_AFTER_MS = 5 * 60_000;
const SESSION_KEY = "ficonter:usage-session-id";

function createSessionId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return "00000000-0000-4000-8000-" +
    Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12);
}

function getSessionId() {
  if (typeof window === "undefined") return createSessionId();

  const stored = window.sessionStorage.getItem(SESSION_KEY);
  if (stored) return stored;

  const created = createSessionId();
  window.sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

function titleCase(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function moduleFromPath(pathname: string, workspace: UsageScope) {
  const prefix = workspace === "personal" ? "/dashboard" : "/business";
  const relative = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : pathname;
  const segment = relative.split("/").filter(Boolean)[0];

  if (!segment) return "Overview";

  const labels: Record<string, string> = {
    admin: workspace === "business" ? "Business Admin" : "Personal Admin",
    administration: "Administration",
    budget: "Monthly Planner",
    "cash-flow": "Cash Flow",
    "cost-control": "Cost Control",
    debt: "Debts",
    documents: "Documents",
    goals: "Goals",
    inventory: "Inventory",
    manage: "Businesses",
    overview: "Overview",
    reports: "Reports",
    sales: "Sales",
    savings: "Savings",
    suppliers: "Suppliers",
    transactions: "Transactions",
  };

  return labels[segment] ?? titleCase(segment);
}

export function UsageHeartbeat({
  workspace,
}: {
  workspace: UsageScope;
}) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const sessionIdRef = useRef("");
  const idleRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);
  const moduleName = useMemo(
    () => moduleFromPath(pathname, workspace),
    [pathname, workspace],
  );

  const sendHeartbeat = useCallback(
    async (visibleOverride?: boolean) => {
      if (typeof document === "undefined") return;

      if (!sessionIdRef.current) {
        sessionIdRef.current = getSessionId();
      }

      const visible =
        visibleOverride ??
        (document.visibilityState === "visible" && !idleRef.current);

      const { error } = await supabase.rpc(
        "record_platform_usage_heartbeat",
        {
          p_session_id: sessionIdRef.current,
          p_workspace: workspace,
          p_module: moduleName,
          p_visible: visible,
        },
      );

      if (
        error &&
        process.env.NODE_ENV === "development"
      ) {
        console.warn("Usage heartbeat was not recorded", error.message);
      }
    },
    [moduleName, supabase, workspace],
  );

  useEffect(() => {
    void sendHeartbeat();
  }, [sendHeartbeat]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [sendHeartbeat]);

  useEffect(() => {
    function scheduleIdleTimer() {
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }

      idleTimerRef.current = window.setTimeout(() => {
        idleRef.current = true;
        void sendHeartbeat(false);
      }, IDLE_AFTER_MS);
    }

    function markActivity() {
      const wasIdle = idleRef.current;
      idleRef.current = false;
      scheduleIdleTimer();

      if (wasIdle && document.visibilityState === "visible") {
        void sendHeartbeat(true);
      }
    }

    const activityEvents = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
    ] as const;

    for (const eventName of activityEvents) {
      window.addEventListener(eventName, markActivity, {
        passive: true,
      });
    }

    scheduleIdleTimer();

    return () => {
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, markActivity);
      }
      if (idleTimerRef.current) {
        window.clearTimeout(idleTimerRef.current);
      }
    };
  }, [sendHeartbeat]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        void sendHeartbeat(false);
      } else {
        idleRef.current = false;
        void sendHeartbeat(true);
      }
    }

    function handlePageHide() {
      void sendHeartbeat(false);
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [sendHeartbeat]);

  return null;
}
