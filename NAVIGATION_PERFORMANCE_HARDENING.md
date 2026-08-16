# FICONTER — Navigation Performance Hardening

Target branch name: `feature/navigation-performance-hardening`

This patch is built on top of the supplied `feature/instant-business-switching` source snapshot. The archive contains no `.git` history, so the branch name is a handoff target rather than a Git branch created inside this environment.

## Behavior now

- Internal links are prefetched on pointer, touch, focus, and prioritized idle warming.
- Rapid duplicate taps are suppressed before they can create duplicate App Router transitions.
- Main imperative navigation paths (desktop account routes, Back, mobile/PWA Back and Add Transaction, command palette, notifications, support handoff) use the same navigation-intent coordinator.
- The navigation listener remains mounted for the workspace session instead of being torn down and recreated after every route change.
- Realtime `router.refresh()` work yields while a route transition is pending, eliminating refresh-vs-navigation races.
- Overview-specific realtime refresh and currency reconciliation also refuse to race an active navigation.
- The mobile/PWA More drawer no longer launches a redundant all-route prefetch burst every time it opens.
- Healthy navigation stays client-side and keeps `scroll: false` where already governed.
- A stalled App Router transition gets one client-side retry after 5.5 seconds.
- If the client router is still stuck after 11 seconds, a last-resort document navigation recovers the requested screen instead of leaving the app permanently frozen.
- Personal and Business workspaces now have route error boundaries with Retry and Overview recovery actions.
- Business now has the same immediate route-loading boundary available to Personal.
- New recovery copy is covered by all eight supported FICONTER languages.

## Existing governance preserved

- Phone rule remains: one tap -> one client-side route -> one slide -> stop.
- Tablet/iPad and larger layouts remain in their governed navigation model.
- Business profile switching remains immediate and does not reintroduce Apply/Save.
- Explicit Save governance remains unchanged everywhere else.
- No landing-page behavior is changed by this patch.

## Verification

- Navigation hardening: 22/22
- Mobile single-navigation V1.11: 11/11
- Responsive navigation V1.13: 13/13
- Mobile Back/Home V1.19: 12/12
- Instant Business switching: 18/18
- Explicit Save governance: 23/23
- Navigation/theme V1.29: 19/19
- Localization: PASS, 0 uncovered static strings/templates
- Release candidate: PASS, 67 current suites
- Modified TypeScript/TSX syntax transpilation: PASS

A full `next build` was not run because the supplied source archive does not include `node_modules` and this environment does not have the project dependencies installed locally.
