# FICONTER Mobile Navigation V1.11 — Single Route Transition

## Rule
A mobile navigation action is allowed to happen only once:

1. One tap.
2. One client-side route change.
3. One page-stack slide.
4. The screen settles immediately.

## Fixes
- Settings no longer changes the child section locally before navigating.
- Settings route state synchronizes before paint to avoid a second visible content swap.
- Requests to open the route that is already active are ignored.
- Personal and Business Back buttons ignore same-route targets.
- Page transition tracking will not replay the animation for the same route key.
- No route-opening flow uses `router.refresh()`.
- The legacy second screen-transition stylesheet remains unloaded.

## Commit message
`fix(mobile): prevent duplicate navigation and repeated page slide`
