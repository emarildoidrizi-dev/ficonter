# FICONTER Mobile UI Phase 3

## Scope
Phase 3 redesigns the mobile application chrome only: the fixed header, bottom navigation, navigation drawer, and legacy mobile-navigation cleanup. It builds on the Phase 2 theme/typography stabilization and does not redesign individual financial modules.

## Changes
- Reworked the phone/tablet header into a smaller, stable FICONTER route bar.
- Kept the mobile chrome on the dedicated stable chrome token set from Phase 2.
- Refined the five-slot bottom dock: Home / Activity (or Sales) / Quick Add / Plan (or Activity) / More.
- Added a clear active-state indicator to the dock.
- The More control now shows an active state whenever the current route is outside the primary dock routes.
- Reorganized the drawer into meaningful groups instead of one long flat list.
  - Personal: Overview, Money, Planning, Wealth, Tools & account.
  - Business: Overview, Operations, Management.
- Reduced drawer row density while preserving 44px+ touch targets.
- Preserved subscription locks and the Business Pro upgrade routing.
- Preserved workspace switching and sign out.
- Added Escape-key drawer closing and reduced-motion support.
- Improved narrow-phone, tablet, portrait, and short-landscape containment.
- Removed the unused `MobileNavigationController` and `PWAMobileDock` component files.
- Removed obsolete `data-ficonter-pwa-phone` CSS, which no runtime code sets anymore.
- Removed dead legacy navigation references from `native-mobile-app.css`.

## Explicit non-goals
- No desktop navigation redesign.
- No financial calculations changed.
- No database/auth/subscription contract changes.
- No module-by-module mobile layout redesign yet.

## Verification
- `verify-mobile-ui-phase2.mjs`: 19 checks passed.
- `verify-mobile-ui-phase3.mjs`: 17 checks passed.
- Interface theme verification: 18 checks passed.
- Theme contrast/monthly budget verification: 18 checks passed.
- Wallpaper verification passed.
- Sidebar verification passed.
- Fixed redesign layout verification: 48 checks passed.
- `FiconterNativeAppChrome.tsx` TypeScript transpile/syntax check passed.
- Structural CSS brace checks passed for the modified CSS files.

Vercel remains the final Next.js/TypeScript production-build validation because a complete dependency install was not available in the packaging environment.

## Suggested live acceptance test
1. Open Personal workspace on a phone in portrait.
2. Verify header remains fixed and route title updates immediately between routes.
3. Verify Home, Activity, Plan and More active states.
4. Open More and inspect the grouped navigation.
5. Open a secondary route such as Bills; verify More is highlighted.
6. Verify locked subscription routes still lead to the upgrade path.
7. Switch Personal <-> Business.
8. Verify Business drawer grouping and dock routes.
9. Rotate portrait <-> landscape; verify no controls leave the viewport.
10. Test a tablet-sized device.
11. Change themes; navigation chrome should remain stable while workspace content follows the selected theme.
12. Sign out and log back in.
