const FICONTER_PWA_STATIC_CACHE_PREFIX = "ficonter-pwa-static-";

export function isInstalledStandaloneApp() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const root = document.documentElement;
  const standalone =
    root.dataset.ficonterDisplayMode === "standalone" ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  return standalone && root.dataset.ficonterNativeApp === "true";
}

export async function clearFiconterPwaStaticCaches() {
  if (typeof window === "undefined" || !("caches" in window)) return;

  const cacheKeys = await window.caches.keys();
  await Promise.all(
    cacheKeys
      .filter((key) => key.startsWith(FICONTER_PWA_STATIC_CACHE_PREFIX))
      .map((key) => window.caches.delete(key)),
  );
}

export async function updateFiconterServiceWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration("/");
  if (registration) await registration.update();
}

export async function recoverInstalledAppRuntime() {
  if (typeof window === "undefined") return;

  await Promise.allSettled([
    clearFiconterPwaStaticCaches(),
    updateFiconterServiceWorker(),
  ]);

  window.location.reload();
}
