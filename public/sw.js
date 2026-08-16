const CACHE_NAME = "ficonter-pwa-static-v14-mobile-runtime-recovery-v135";
const RUNTIME_VERSION = "v135";

const PRECACHE_URLS = [
  "/offline.html",
  "/icon.svg",
  "/ficonter-mark.svg",
  "/apple-icon.png",
  "/ficonter-app-icon.png",
  "/icons/ficonter-192.png",
  "/icons/ficonter-512.png",
  "/icons/ficonter-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("ficonter-pwa-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );

      await self.clients.claim();

      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      clients.forEach((client) => {
        client.postMessage({ type: "FICONTER_SW_ACTIVATED", version: RUNTIME_VERSION });
      });
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never proxy Next.js build assets through the service-worker cache. Their
  // build-specific URLs must stay aligned with the HTML/RSC payload currently
  // served by the deployment. The browser HTTP cache can still cache them.
  if (url.pathname.startsWith("/_next/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const offlinePage = await caches.match("/offline.html");
        return offlinePage || Response.error();
      }),
    );
    return;
  }

  const isSafeStaticAsset =
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/wallpapers/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/ficonter-mark.svg" ||
    url.pathname === "/apple-icon.png" ||
    url.pathname === "/ficonter-app-icon.png";

  if (!isSafeStaticAsset) return;

  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      const networkPromise = fetch(request)
        .then(async (networkResponse) => {
          if (networkResponse.ok && networkResponse.type === "basic") {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        event.waitUntil(networkPromise.then(() => undefined));
        return cachedResponse;
      }

      return (await networkPromise) || Response.error();
    }),
  );
});
