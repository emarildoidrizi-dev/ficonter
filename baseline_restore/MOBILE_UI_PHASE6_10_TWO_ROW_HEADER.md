# FICONTER Mobile UI Phase 6.10 — Ordered Two-Row Header

## Requested hierarchy

The mobile header is now one ordered two-row area:

1. **Brand row** — original FICONTER website emblem + compact `FICONTER / Financial Control Center` identity on the left, one real profile-photo control on the right.
2. **Context row** — Menu on workspace Overview (Back on deeper screens), current module title in the middle, and `PERSONAL ·` or `BUSINESS ·` on the right.

The old emblem/menu badge stack is disabled so controls cannot overlap or duplicate.

## Preserved behavior

- Original website emblem asset (`/ficonter-mark.svg`)
- Actual saved profile photo, with initial fallback
- Account popup contains Log out only
- Menu opens the full mobile navigation only from Overview
- Deeper screens retain Back and edge-swipe-back behavior
- Business active-profile selector remains in the fixed header beneath the two rows
- Bottom dock and compact screen-stack behavior are unchanged
- Personal and Business content get matching top clearance so the new header never covers content

## QA

- Phase 6.10 ordered-header verifier: 18 checks passed
- Mobile Phase 2–6 verifiers passed
- Compact screen-stack verifier passed
- Phase 6.9 avatar/header verifier passed
- Appearance/theme verifiers passed
- Monthly budget verifier passed
- Modified CSS parsed with 0 syntax errors
- Modified TSX transpile syntax diagnostics: 0

Vercel remains the final Next.js production build/type-check gate.
