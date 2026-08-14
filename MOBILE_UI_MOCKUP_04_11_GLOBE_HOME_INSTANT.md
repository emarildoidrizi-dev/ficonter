# FICONTER Mobile Mockup 04.11 — Globe + Direct Home

## Changes

- Added a globe-only language selector to the authenticated mobile header, positioned beside the profile avatar.
- The globe opens the existing shared language list and uses the same persisted language state as landing, login, and authenticated Settings.
- Personal Home now targets `/dashboard/overview` directly instead of the legacy `/dashboard` redirect route.
- Tapping Home while already on Overview now only scrolls to the top; it does not navigate or trigger a loading/refresh-like cycle.
- Tapping Home from another Personal section prefetches and pushes directly to `/dashboard/overview`.
- Navigation background prefetch now warms `/dashboard/overview` directly.
- The Home active state now correctly recognizes `/dashboard/overview`.

## Validation

- `verify-mobile-ui-phase6-11-profile-home-instant.mjs`: 13/13
- `verify-public-language-mirror.mjs`: 16/16
- `verify-mobile-ui-phase6.mjs`: 24/24
- `verify-mobile-ui-phase2.mjs`: 19/19
- Syntax/transpile validation passed for the modified TSX files.
