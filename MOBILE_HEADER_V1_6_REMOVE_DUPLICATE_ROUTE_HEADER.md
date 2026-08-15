# MOBILE HEADER V1.6 — REMOVE DUPLICATE ROUTE HEADER

## Locked mobile header rule
- The light Sidebar / BusinessSidebar utility header is the **only** mobile top header.
- The legacy `FiconterNativeAppChrome` route header is permanently hidden on all native mobile/tablet layouts.
- The bottom navigation / More drawer from `FiconterNativeAppChrome` remains active.
- The contextual Back button remains in the approved light utility header on secondary pages.
- Applies to Personal, Business, and Admin mobile routes.

## File changed
- `components/FiconterNativeAppChrome.module.css`

## Commit message
`fix(mobile): permanently remove duplicate route header`
