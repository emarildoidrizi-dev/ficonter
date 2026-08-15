# FICONTER Mobile UI Phase 6.5 — Website Brand + Vertical Scroll Fix

## Branding
- Restores the exact canonical `ficonter-mark.svg` used by the FICONTER website/platform before the experimental Phase 6.3 brand refresh.
- Restores the website `Brand` component typography: serif FICONTER wordmark + `Financial Control Center` descriptor.
- Restores canonical browser/PWA/Apple/192/512/maskable icons.
- Mobile shell and loading screen now reference the canonical website emblem.
- Experimental `*-v2` brand assets are removed.
- Service-worker cache is bumped to `ficonter-pwa-static-v5-website-brand` so clients refresh the restored assets.

## Scrolling
- Explicitly enables document-level vertical touch scrolling when the More/navigation sheet is closed.
- Restores `overflow-y:auto`, `touch-action:pan-y`, and iOS momentum scrolling at the authoritative final CSS layer.
- Raises mobile bottom content clearance to 184px so final cards can scroll fully above the fixed dock and raised quick-add button.
- Adds 20px breathing room after the final module child.
- Keyboard-open and short-landscape modes keep compact dedicated spacing.

## Scope
No financial calculations, Supabase schema, subscription rules, currency logic, realtime data, routes, or business switching logic are changed.
