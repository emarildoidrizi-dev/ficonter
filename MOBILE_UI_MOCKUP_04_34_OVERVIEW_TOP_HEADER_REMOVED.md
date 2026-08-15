# MOBILE UI MOCKUP 04.34 — OVERVIEW TOP HEADER REMOVED

## Change applied
- Removed the dark green fixed top header on the personal homepage (`/dashboard/overview`).
- Kept the lower in-page utility row/homepage controls untouched.
- Reduced the mobile top spacing on the homepage by setting the native header height to `0px` only while the personal overview route is active.
- Other personal routes and business routes still keep the fixed top header.

## File changed
- `components/FiconterNativeAppChrome.tsx`

## Commit message
`fix(mobile): remove duplicate top header on personal overview`
