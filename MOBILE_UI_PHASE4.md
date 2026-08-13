# FICONTER Mobile UI Stabilization — Phase 4

## Scope
Phase 4 converts the financial and business workspaces from compressed desktop layouts into predictable phone/tablet module layouts. Desktop remains unchanged because every new layout rule is scoped to `html[data-ficonter-native-app="true"]`.

## What changed
- Added `app/mobile-module-layouts.css`, loaded after the existing theme/mobile/coastal layers.
- Added a centered mobile content width system for phones and tablets.
- Reworked Personal Overview cards into a vertical mobile feed with compact amounts, health, upcoming bills and actions.
- Reworked Transactions into touch-first filters, swipeable summary cards, non-nested page scrolling and compact action cards.
- Reworked Monthly Planner into a single-column planning flow with compact month navigation, budget form, breakdown controls and safe expense-table scrolling.
- Reworked Bills, Credit Cards, Debt and Goals into single-column phone cards with swipeable summary rails and full-width actions.
- Reworked Savings, Cash Flow, Net Worth and Financial GPS into mobile metric rails plus single-column analysis panels.
- Reworked Settings so the section navigator becomes a horizontal mobile rail and the selected settings panel fills the screen width.
- Reworked Business transactions, sales, profiles, inventory, suppliers, reports and cost control with the same mobile patterns.
- Standardized modal presentation as bottom sheets in mobile mode.
- Added narrow-phone (`<=430px`) and tablet (`>=700px`) adaptations.
- Added `npm run verify:mobile-ui-phase4`.

## Design rules
1. No desktop selector is modified by Phase 4.
2. Avoid nested vertical scroll areas on phones; the page is the primary vertical scroller.
3. KPI/summary collections use horizontal snap rails when stacking would make the page excessively long.
4. Data-entry forms use one column on phones.
5. Destructive and financial actions stay large enough for touch interaction.
6. Tables that cannot be represented safely as cards retain controlled horizontal scrolling rather than truncating values.

## Live acceptance
Check at minimum:
- Personal: Overview, Transactions, Monthly Planner, Bills, Credit Cards, Debt, Goals, Savings, Cash Flow, Net Worth, GPS, Settings.
- Business: Overview, Transactions, Sales, Manage, Inventory, Suppliers, Reports, Cost Control.
- Widths: ~320–360px, ~390–430px, tablet.
- Portrait and landscape.
- Light, Dark and premium themes.
- Browser and installed PWA.
