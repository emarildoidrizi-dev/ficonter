# FICONTER V1.35 — PWA Mobile Runtime Recovery

Purpose: recover the installed mobile app from stale-build and main-thread pressure failures without changing financial logic or the landing page.

## Runtime safeguards

- Next.js `/_next/*` build assets are no longer intercepted or cached by the FICONTER service worker.
- Navigation remains network-first and falls back to `offline.html` only when the network request fails.
- Old FICONTER service-worker caches are removed during activation.
- Service-worker takeover triggers one guarded reload for already-controlled clients so an old document does not keep running against a new worker indefinitely.
- Chunk/CSS load failures from `/_next/static/*` trigger one guarded cache cleanup + reload recovery.

## Phone performance safeguards

- Native/installed phones no longer background-prefetch the full financial application. Only two root destinations are warmed; touched routes are still prefetched on demand.
- Theme contrast auditing remains enabled but processes small batches across animation frames instead of blocking the phone main thread with one full synchronous scan.

## Scope

No financial calculation, database, subscription, role, landing-page, or account-governance logic is changed by this release.
