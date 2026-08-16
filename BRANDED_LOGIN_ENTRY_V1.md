# FICONTER Branded Login Entry V1

## Goal
Give the FICONTER app a polished brand entrance without slowing or destabilizing navigation.

## Behavior
- Installed/PWA launch starts at `/login?entry=app` instead of `/dashboard`.
- The login page is rendered immediately behind a fixed full-screen brand entrance layer.
- The FICONTER emblem scales in with a restrained bounce/settle motion.
- The FICONTER wordmark and `Financial Control Center` descriptor follow smoothly.
- A short brand-colored sweep completes the transition.
- The standard entrance remains visible for about 3.2 seconds, then fades smoothly to reveal the already-loaded login form.
- No intermediate route, browser refresh, or extra network navigation is introduced.
- After the animation, the `entry` query is removed with `history.replaceState`, so it does not pollute Back navigation.
- `prefers-reduced-motion` receives a non-bouncing alternative that remains visible for about 2.2 seconds before fading.

## Session behavior
- If a user is already authenticated and reaches `/login`, the server redirects directly to `/dashboard` and the entrance is skipped.
- Existing installed PWAs that still launch `/dashboard` are covered: the authenticated workspace layouts redirect signed-out sessions to `/login?entry=app`.

## Website behavior
The public marketing homepage remains intact. Its Log in links request `/login?entry=brand`, so users entering from the website see the same polished transition.

## Performance principle
The animation is deliberately a visual overlay on the final login route. It does not add a splash route or client-side route transition, preserving the navigation-performance hardening work.
- App/PWA branded login entry hides the public “Back to homepage” link; ordinary website login keeps it.
