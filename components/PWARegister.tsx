"use client";

import { useEffect, useRef } from "react";
import { isFiconterNavigationPending } from "@/lib/navigationRuntime";
import { isInstalledStandaloneApp } from "@/lib/pwaRuntimeRecovery";

const SERVICE_WORKER_UPDATE_INTERVAL_MS = 5 * 60 * 1000;
const CONTROLLER_REFRESH_KEY = "ficonter:pwa-controller-refresh";
const CONTROLLER_REFRESH_TTL_MS = 60 * 1000;

export function PWARegister() {
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    let controllerReloadScheduled = false;
    let controllerRetryTimer: number | null = null;
    const hadControllerAtMount = Boolean(navigator.serviceWorker.controller);

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

    const refreshForNewController = () => {
      if (
        cancelled ||
        controllerReloadScheduled ||
        !hadControllerAtMount ||
        !isInstalledStandaloneApp() ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      if (isFiconterNavigationPending()) {
        if (controllerRetryTimer === null) {
          controllerRetryTimer = window.setTimeout(() => {
            controllerRetryTimer = null;
            refreshForNewController();
          }, 750);
        }
        return;
      }

      const now = Date.now();
      try {
        const previousRefresh = Number(
          window.sessionStorage.getItem(CONTROLLER_REFRESH_KEY) || "0",
        );
        if (
          Number.isFinite(previousRefresh) &&
          now - previousRefresh < CONTROLLER_REFRESH_TTL_MS
        ) {
          return;
        }
        window.sessionStorage.setItem(CONTROLLER_REFRESH_KEY, String(now));
      } catch {
        // Session storage is an optimization only; the refresh is still safe.
      }

      controllerReloadScheduled = true;
      window.location.reload();
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
        // A home-screen app can stay suspended on iOS for hours or days.
        // Always check the service worker when the app becomes foregrounded.
        void updateRegistration(true);
      }
    };

    const handleOnline = () => {
      void updateRegistration(true);
    };

    const updateTimer = window.setInterval(() => {
      void updateRegistration(false);
    }, SERVICE_WORKER_UPDATE_INTERVAL_MS);

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      refreshForNewController,
    );
    document.addEventListener("visibilitychange", refreshRegistration);
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.clearInterval(updateTimer);
      if (controllerRetryTimer !== null) {
        window.clearTimeout(controllerRetryTimer);
      }
      window.removeEventListener("load", register);
      window.removeEventListener("online", handleOnline);
      document.removeEventListener("visibilitychange", refreshRegistration);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        refreshForNewController,
      );
    };
  }, []);

  return null;
}
