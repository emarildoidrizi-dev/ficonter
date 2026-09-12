"use client";

import { useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DIRECTORY_POLL_INTERVAL_MS = 30_000;
const REALTIME_REFRESH_DEBOUNCE_MS = 180;

export function AdminDirectoryAutoRefresh() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    function refreshNow() {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }

    function scheduleRefresh() {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(
        refreshNow,
        REALTIME_REFRESH_DEBOUNCE_MS,
      );
    }

    const channel = supabase
      .channel("admin-subscription-directory-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
        },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "beta_user_entitlements",
        },
        scheduleRefresh,
      )
      .subscribe();

    const interval = window.setInterval(
      refreshNow,
      DIRECTORY_POLL_INTERVAL_MS,
    );

    function onVisibilityChange() {
      if (document.visibilityState === "visible") refreshNow();
    }

    window.addEventListener("focus", refreshNow);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshNow);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  return null;
}
