"use client";

import { useEffect, useRef } from "react";
import { isFiconterNavigationPending } from "@/lib/navigationRuntime";

const SERVICE_WORKER_UPDATE_INTERVAL_MS = 30 * 60 * 1000;

export function PWARegister() {
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const updateRegistration = async (force = false) => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (isFiconterNavigationPending()) return;
      if (!navigator.onLine) return;

      const now = Date.now();
      if (
        !force &&
        now - lastUpdateRef.current < SERVICE_WORKER_UPDATE_INTERVAL_MS
      ) {
        return;
      }

      try {
        const registration = await navigator.serviceWorker.getRegistration("/");
        if (!registration || cancelled) return;
        lastUpdateRef.current = now;
        await registration.update();
      } catch {
        // The current app session remains usable if an update check fails.
      }
    };

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        if (!cancelled) void updateRegistration(true);
      } catch {
        // The normal Ficonter website remains fully usable.
      }
    };

    if (document.readyState === "complete") {
      void register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    const refreshRegistration = () => {
      if (document.visibilityState === "visible") {
        void updateRegistration(false);
      }
    };

    const handleOnline = () => {
      void updateRegistration(false);
    };

    document.addEventListener("visibilitychange", refreshRegistration);
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", refreshRegistration);
    };
  }, []);

  return null;
}
