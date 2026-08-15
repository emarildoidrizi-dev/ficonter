const CACHE_NAME = "ficonter-pwa-static-v9-planner-profile-v130";

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
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key.startsWith("ficonter-pwa-") &&
                  key !== CACHE_NAME,
              )
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

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
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/wallpapers/") ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/ficonter-mark.svg" ||
    url.pathname === "/apple-icon.png" ||
    url.pathname === "/ficonter-app-icon.png";

  if (!isSafeStaticAsset) return;

  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      const networkResponse = await fetch(request);

      if (
        networkResponse.ok &&
        networkResponse.type === "basic"
      ) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    }),
  );
});
