# FICONTER Platform Performance & Stability V2

This release hardens the existing navigation-performance layer without changing FICONTER's product behavior or explicit-save governance.

## Main changes

- Recovers stale navigation state after bfcache restores, offline transitions, interrupted PWA navigation, and pathological route failures.
- Detects stale/dynamic chunk-load failures after deployments and performs one guarded recovery reload instead of leaving a dead screen.
- Shortens pathological route recovery while leaving healthy App Router transitions client-side.
- Prevents background prefetch bursts on Save-Data/2G connections and bounds route-prefetch memory across Business profiles.
- Defers realtime refresh work that would otherwise reconcile the old/new RSC tree during navigation.
- Coalesces repeated full financial-source queries and ignores non-financial events.
- Throttles service-worker update checks so focusing the PWA does not repeatedly compete with navigation/network requests.
- Defers the Owner Music library fetch until browser idle or explicit use.
- Removes several redundant full-page reloads and Business route replace+refresh double fetches.
- Makes Business sign-out use the same deterministic hard exit used by Personal.

## Reliability rule

Normal navigation remains client-side. Hard reload is reserved for detected stale chunk/deployment failures or existing auth/gate boundaries where a clean browser session transition is intentional.

## Branch

`feature/platform-performance-stability-v2`

## Suggested commit

`perf(platform): harden navigation refresh and runtime recovery`
