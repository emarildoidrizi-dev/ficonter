"use client";

import { useEffect } from "react";

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register(
          "/sw.js",
          {
            scope: "/",
            updateViaCache: "none",
          },
        );

        if (!cancelled) {
          void registration.update().catch(() => undefined);
        }
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
      if (document.visibilityState !== "visible") return;

      void navigator.serviceWorker
        .getRegistration("/")
        .then((registration) => registration?.update())
        .catch(() => undefined);
    };

    document.addEventListener(
      "visibilitychange",
      refreshRegistration,
    );

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
      document.removeEventListener(
        "visibilitychange",
        refreshRegistration,
      );
    };
  }, []);

  return null;
}
