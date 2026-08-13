# FICONTER Mobile UI — Phase 6.3 Brand Refresh

This correction replaces the unchanged legacy FICONTER emblem/wordmark assets that remained in Phase 6.2.

## What changed
- New **Command Frame** emblem: geometric open `C` control frame + integrated `F` + precision marker.
- New modern sans-serif FICONTER wordmark treatment; the former Georgia/serif wordmark is removed from the shared Brand component.
- Landing page, auth/sidebar Brand component, dashboard loading screen, mobile top command bar and mobile More sheet now use the new emblem.
- PWA/app icons regenerated at 192px / 512px / maskable / Apple sizes.
- Unique `v2` icon filenames are used in metadata and manifest to avoid sticky Safari/PWA icon caches.
- Service worker cache generation bumped from `ficonter-pwa-static-v3` to `ficonter-pwa-static-v4-brand`.
- Legacy icon filenames are also overwritten with the new artwork so no residual reference can show the previous mark.

## Important iPhone note
Safari will fetch the new web header emblem after deployment. If FICONTER is already installed on the iPhone Home Screen, iOS can retain the old Home Screen icon independently; removing and re-adding the installed PWA is the reliable way to refresh that OS-level icon.
