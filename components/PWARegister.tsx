"use client";

import { useEffect } from "react";

const PWA_RUNTIME_VERSION = "v135";
const CONTROLLER_RELOAD_KEY = `ficonter:pwa-controller-reload:${PWA_RUNTIME_VERSION}`;
const ASSET_RECOVERY_KEY = `ficonter:pwa-asset-recovery:${PWA_RUNTIME_VERSION}`;

function isNextStaticUrl(value: unknown) {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value, window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith("/_next/static/");
  } catch {
    return value.includes("/_next/static/");
  }
}

function runtimeAssetFailure(event: Event | PromiseRejectionEvent) {
  if (event instanceof PromiseRejectionEvent) {
    const reason = event.reason;
    const message = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason ?? "");
    return (
      /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|CSS chunk/i.test(message) ||
      isNextStaticUrl(message)
    );
  }

  const target = event.target;
  if (target instanceof HTMLScriptElement) return isNextStaticUrl(target.src);
  if (target instanceof HTMLLinkElement) return isNextStaticUrl(target.href);

  if (event instanceof ErrorEvent) {
    return (
      /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|CSS chunk/i.test(
        `${event.message} ${event.error instanceof Error ? event.error.message : ""}`,
      ) || isNextStaticUrl(event.filename)
    );
  }

  return false;
}

async function clearLegacyFiconterCaches() {
  if (!("caches" in window)) return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("ficonter-pwa-") || key.startsWith("ficonter-pwa-static-"))
        .map((key) => caches.delete(key)),
    );
  } catch {
    // Cache cleanup is a recovery enhancement, never a blocker for the website.
  }
}

export function PWARegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;
    const hadControllerAtMount = Boolean(navigator.serviceWorker.controller);

    const reloadForFreshController = () => {
      if (cancelled || !hadControllerAtMount) return;

      try {
        if (sessionStorage.getItem(CONTROLLER_RELOAD_KEY) === "1") return;
        sessionStorage.setItem(CONTROLLER_RELOAD_KEY, "1");
      } catch {
        // If sessionStorage is unavailable, controllerchange still only fires on a real takeover.
      }

      window.location.reload();
    };

    const recoverFromBrokenRuntimeAsset = (event: Event | PromiseRejectionEvent) => {
      if (!runtimeAssetFailure(event)) return;

      try {
        if (sessionStorage.getItem(ASSET_RECOVERY_KEY) === "1") return;
        sessionStorage.setItem(ASSET_RECOVERY_KEY, "1");
      } catch {
        // Continue with a best-effort recovery if storage is unavailable.
      }

      void (async () => {
        await clearLegacyFiconterCaches();
        try {
          const registration = await navigator.serviceWorker.getRegistration("/");
          await registration?.update();
        } catch {
          // Reloading from the network is still the correct recovery path.
        }
        if (!cancelled) window.location.reload();
      })();
    };

    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type !== "FICONTER_SW_ACTIVATED") return;
      if (event.data?.version !== PWA_RUNTIME_VERSION) return;
      // controllerchange performs the one-time reload for existing controlled clients.
    };

    navigator.serviceWorker.addEventListener("controllerchange", reloadForFreshController);
    navigator.serviceWorker.addEventListener("message", handleWorkerMessage);
    window.addEventListener("error", recoverFromBrokenRuntimeAsset, true);
    window.addEventListener("unhandledrejection", recoverFromBrokenRuntimeAsset);

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        if (registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        if (!cancelled) {
          await registration.update().catch(() => undefined);
        }
      } catch {
        // The normal Ficonter website remains fully usable without service worker support.
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
        .then(async (registration) => {
          if (!registration) return;
          if (registration.waiting) registration.waiting.postMessage({ type: "SKIP_WAITING" });
          await registration.update();
        })
        .catch(() => undefined);
    };

    document.addEventListener("visibilitychange", refreshRegistration);

    return () => {
      cancelled = true;
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", refreshRegistration);
      navigator.serviceWorker.removeEventListener("controllerchange", reloadForFreshController);
      navigator.serviceWorker.removeEventListener("message", handleWorkerMessage);
      window.removeEventListener("error", recoverFromBrokenRuntimeAsset, true);
      window.removeEventListener("unhandledrejection", recoverFromBrokenRuntimeAsset);
    };
  }, []);

  return null;
}
