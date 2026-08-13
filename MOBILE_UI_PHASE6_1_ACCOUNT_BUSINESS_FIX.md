# Mobile UI Phase 6.1 — Account + Business Profile Fix

## Corrected
- The signed-in account control is now permanently visible in the top-right mobile header.
- Opening the account/navigation sheet shows the account identity and Sign out action at the top instead of at the bottom.
- Business workspace now has a persistent Active business selector directly under the top command bar.
- The same business-profile selector is also available near the top of the More sheet for discoverability.
- Business switching uses the existing `switchActiveBusinessAction`, updates the selected business optimistically, and calls `router.refresh()` automatically after the server confirms the switch.
- Archived businesses are excluded from the mobile selector, matching the existing desktop business selector behavior.
- Business workspace content receives an adjusted top offset so the new selector never overlaps the page.
- Personal workspace keeps the compact single-row header.

## Files changed
- `components/FiconterNativeAppChrome.tsx`
- `components/FiconterNativeAppChrome.module.css`
- `app/native-mobile-app.css`
- `app/business/layout.tsx`
- `app/dashboard/layout.tsx`

## Validation
- Modified TS/TSX files pass TypeScript syntax transpilation.
- CSS brace integrity passed.
- ZIP integrity passed before delivery.

Vercel remains the final Next.js production/type-check gate.
